import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Modal,
  Switch,
  Animated,
  Pressable,
  useWindowDimensions,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ThemedDialog } from '../components/ThemedDialog';
import {
  deleteLocalPeriodLogByStartDate,
  deleteLocalPeriodLogsByMonth,
  getLocalPeriodLogs,
  replaceLocalPeriodLog,
} from '../services/localPeriodLogs';
import {
  deletePeriodLogByStartDate,
  deletePeriodLogsByMonth,
  getPeriodLogs,
  replacePeriodLog,
} from '../services/periodLogs';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  ensureNotificationPermission,
  getNotificationPreferences,
  isNotificationFeatureAvailable,
  rescheduleCycleNotifications,
  saveNotificationPreferences,
} from '../services/notificationPreferences';
import { getCyclePrediction } from '../utils/cyclePredictions';
import { getAffirmations } from '../constants/Affirmations';
import { DEFAULT_CYCLE_SETTINGS, getClampedCycleLength, getCycleSettings, saveCycleSettings } from '../services/cycleSettings';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOME_TOUR_COMPLETED_KEY = 'ownapp_home_tour_completed_v1';
const HELP_TOUR_CARD_WIDTH = 280;
const HELP_TOUR_TAIL_OUTER_SIZE = 14;
const HELP_TOUR_TAIL_INNER_SIZE = 12;
const HELP_TOUR_TARGET_GAP = 5;
const HELP_TOUR_BODY_ESTIMATED_HEIGHT = 108;
const HELP_TOUR_VERTICAL_OFFSETS = {
  menu: 31,
  settings: 31,
  calendar: 30,
  quickStart: 30,
};

const HELP_TOUR_STEP_KEYS = [
  {
    key: 'menu',
    titleKey: 'tour.menuTitle',
    messageKey: 'tour.menuMessage',
    placement: 'topLeft',
  },
  {
    key: 'settings',
    titleKey: 'tour.settingsTitle',
    messageKey: 'tour.settingsMessage',
    placement: 'topRight',
  },
  {
    key: 'calendar',
    titleKey: 'tour.calendarTitle',
    messageKey: 'tour.calendarMessage',
    placement: 'center',
  },
  {
    key: 'quickStart',
    titleKey: 'tour.quickStartTitle',
    messageKey: 'tour.quickStartMessage',
    placement: 'center',
  },
];

const QUOTE_BACKGROUND_IMAGES = {
  day: {
    spring: require('../../assets/quote-backgrounds/day/spring.png'),
    summer: require('../../assets/quote-backgrounds/day/summer.png'),
    autumn: require('../../assets/quote-backgrounds/day/autumn.png'),
    winter: require('../../assets/quote-backgrounds/day/winter.png'),
  },
  night: {
    spring: require('../../assets/quote-backgrounds/night/spring.png'),
    summer: require('../../assets/quote-backgrounds/night/summer.png'),
    autumn: require('../../assets/quote-backgrounds/night/autumn.png'),
    winter: require('../../assets/quote-backgrounds/night/winter.png'),
  },
};

const toDateText = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateTextFromParts = (year, monthIndex, day) => {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

const parseDate = (dateText) => new Date(`${dateText}T00:00:00`);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const diffDays = (startDate, endDate) => Math.round((endDate - startDate) / DAY_MS);

const getWeekDates = (today) => {
  const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOfWeek = startOfWeek.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek, index));
};

const getWeekRangeLabel = (weekDates, monthNames) => {
  const start = weekDates[0];
  const end = weekDates[weekDates.length - 1];
  if (!start || !end) return '';

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}-${end.getDate()} ${monthNames[start.getMonth()]} ${end.getFullYear()}`;
  }

  return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
};

const getSeasonKey = (date) => {
  const month = date.getMonth();

  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
};

const getDayPhaseKey = (date) => {
  const hour = date.getHours();
  return hour >= 6 && hour < 19 ? 'day' : 'night';
};

const getCurrentPeriodStatus = ({ logs, prediction, today, t }) => {
  const todayText = toDateText(today);
  const actualLog = logs.find((log) => log.selected_dates?.includes(todayText));

  if (actualLog) {
    const dayIndex = actualLog.selected_dates.indexOf(todayText) + 1;
    const duration = actualLog.duration || actualLog.selected_dates.length || 1;
    const remainingDays = Math.max(1, duration - dayIndex + 1);
    return {
      title: t('status.periodDay', { day: dayIndex }),
      subtitle: t('status.recordedDays', { count: duration }),
      indicatorMode: 'ring',
      progressValue: remainingDays,
      progressTotal: Math.max(1, duration),
    };
  }

  if (prediction.predictedPeriodDates?.has(todayText) && prediction.nextPeriodDateText) {
    const dayIndex = diffDays(parseDate(prediction.nextPeriodDateText), today) + 1;
    const duration = prediction.averagePeriodLength || 5;
    const remainingDays = Math.max(1, duration - dayIndex + 1);
    return {
      title: t('status.predictedDay', { day: dayIndex }),
      subtitle: t('status.periodPhase'),
      indicatorMode: 'ring',
      progressValue: remainingDays,
      progressTotal: Math.max(1, duration),
    };
  }

  const daysLeft = prediction.daysUntilNextPeriod;
  return {
    title: daysLeft == null ? t('status.waitingRecord') : t('status.daysLeft', { count: daysLeft }),
    subtitle: t('status.nextPeriod'),
    indicatorMode: 'icon',
  };
};

const getOvulationStatus = ({ prediction, today, t }) => {
  if (!prediction.ovulationDateText) {
    return {
      title: t('status.waitingRecord'),
      subtitle: t('status.ovulationEstimate'),
      indicatorMode: 'icon',
      accentColorType: 'normal',
    };
  }

  const todayText = toDateText(today);
  const ovulationDate = parseDate(prediction.ovulationDateText);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);
  const daysToOvulation = diffDays(today, ovulationDate);

  if (prediction.fertileDates?.has(todayText)) {
    const fertileDay = diffDays(fertileStart, today) + 1;
    const remainingWindowDays = Math.max(1, diffDays(today, fertileEnd) + 1);
    return {
      title: daysToOvulation === 0 ? t('status.ovulationDay') : t('status.fertileDay', { day: fertileDay }),
      subtitle: daysToOvulation > 0 ? t('status.peakInDays', { count: daysToOvulation }) : t('status.peakToday'),
      indicatorMode: 'ring',
      progressValue: remainingWindowDays,
      progressTotal: 7,
      accentColorType: daysToOvulation === 0 ? 'peak' : 'normal',
    };
  }

  if (today < fertileStart) {
    return {
      title: t('status.daysLeft', { count: diffDays(today, fertileStart) }),
      subtitle: t('status.fertileIn'),
      indicatorMode: 'icon',
      accentColorType: 'normal',
    };
  }

  if (today > fertileEnd) {
    const nextCycleOvulation = addDays(ovulationDate, prediction.averageCycleLength || 28);
    const daysLeft = Math.max(0, diffDays(today, nextCycleOvulation));
    return {
      title: t('status.daysLeft', { count: daysLeft }),
      subtitle: t('status.nextOvulation'),
      indicatorMode: 'icon',
      accentColorType: 'normal',
    };
  }

  return {
    title: t('status.daysLeft', { count: Math.max(0, daysToOvulation) }),
    subtitle: t('status.untilOvulation'),
    indicatorMode: 'icon',
    accentColorType: 'normal',
  };
};

const StatusIndicator = ({ colors, mode, type, accentColor, progressValue = 0, progressTotal = 1 }) => {
  const progressRatio = Math.max(0, Math.min(1, Math.max(0, progressValue) / Math.max(1, progressTotal)));
  const size = 36;
  const strokeWidth = 6;
  const center = size / 2;
  const radius = center - (strokeWidth / 2);
  const circumference = 2 * Math.PI * radius;
  const progressLength = circumference * progressRatio;
  const remainderLength = circumference - progressLength;

  if (mode === 'ring') {
    return (
      <View style={styles.indicatorShell}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={colors.outline}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={accentColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${progressLength} ${Math.max(remainderLength, 0.001)}`}
              strokeLinecap="butt"
              fill="none"
            />
          </G>
        </Svg>
      </View>
    );
  }

  return (
    <View style={styles.indicatorShell}>
      <View
        style={[
          styles.iconShell,
          {
            backgroundColor: type === 'period' ? 'rgba(233, 89, 110, 0.18)' : 'rgba(196, 222, 145, 0.22)',
            borderColor: '#FFFFFF',
          },
        ]}
      >
        {type === 'period' ? (
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M12 2.5C10.5 5.1 6 9.6 6 14.2C6 17.9 8.8 20.5 12 20.5C15.2 20.5 18 17.9 18 14.2C18 9.6 13.5 5.1 12 2.5Z"
              fill="#E53950"
            />
            <Path
              d="M12 2.5C10.5 5.1 6 9.6 6 14.2C6 17.9 8.8 20.5 12 20.5C15.2 20.5 18 17.9 18 14.2C18 9.6 13.5 5.1 12 2.5Z"
              fill="none"
              stroke="#B11F37"
              strokeWidth="1.4"
            />
            <Path
              d="M14.8 7.2C15.8 8.4 16.5 9.9 16.5 11.6"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </Svg>
        ) : (
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M12 3C8.8 3 6.5 6.2 6.5 10.8C6.5 15.8 8.9 20 12 20C15.1 20 17.5 15.8 17.5 10.8C17.5 6.2 15.2 3 12 3Z"
              fill="#CFE69A"
            />
            <Path
              d="M12 3C8.8 3 6.5 6.2 6.5 10.8C6.5 15.8 8.9 20 12 20C15.1 20 17.5 15.8 17.5 10.8C17.5 6.2 15.2 3 12 3Z"
              fill="none"
              stroke="#9DB76A"
              strokeWidth="1.2"
            />
            <Path
              d="M7.7 11.1L10.2 9.6L12.1 11.1L14 9.6L16.3 11"
              fill="none"
              stroke="#6E8B45"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
    </View>
  );
};

const DecorativeBackdrop = ({ variant, palette }) => {
  if (variant === 'quote') {
    return (
      <View pointerEvents="none" style={styles.cardBackdrop}>
        <Svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="none">
          <Circle cx="56" cy="34" r="42" fill={palette.blobA} opacity="0.9" />
          <Circle cx="96" cy="26" r="28" fill={palette.blobB} opacity="0.88" />
          <Circle cx="314" cy="34" r="54" fill={palette.blobC} opacity="0.86" />
          <Ellipse cx="286" cy="120" rx="94" ry="34" fill={palette.hillBack} opacity="0.92" />
          <Path d="M0 134C42 114 78 121 124 138C166 154 210 153 260 130C306 109 333 111 360 126V180H0Z" fill={palette.hillFront} />
          <Path d="M0 150C48 140 99 153 146 160C205 169 256 157 360 145V180H0Z" fill={palette.hillSoft} opacity="0.96" />
          <Path d="M22 68L35 112" stroke={palette.trunk} strokeWidth="7" strokeLinecap="round" />
          <Path d="M37 77L59 118" stroke={palette.trunk} strokeWidth="5" strokeLinecap="round" />
          <Path d="M320 56L307 120" stroke={palette.trunk} strokeWidth="7" strokeLinecap="round" />
          <Path d="M309 76L287 121" stroke={palette.trunk} strokeWidth="5" strokeLinecap="round" />
          <Ellipse cx="80" cy="98" rx="36" ry="22" fill={palette.treeWarm} opacity="0.9" />
          <Ellipse cx="132" cy="108" rx="24" ry="18" fill={palette.treeSoft} opacity="0.88" />
          <Ellipse cx="278" cy="92" rx="28" ry="20" fill={palette.treeCool} opacity="0.84" />
          <Ellipse cx="236" cy="136" rx="10" ry="22" fill={palette.accent} opacity="0.82" />
          <Ellipse cx="33" cy="158" rx="20" ry="30" fill={palette.accent} opacity="0.8" transform="rotate(28 33 158)" />
          <Ellipse cx="333" cy="150" rx="16" ry="28" fill={palette.blobB} opacity="0.84" transform="rotate(-22 333 150)" />
          <Ellipse cx="116" cy="32" rx="5" ry="11" fill={palette.accent} transform="rotate(35 116 32)" />
          <Ellipse cx="250" cy="24" rx="4" ry="9" fill={palette.accentSoft} transform="rotate(-28 250 24)" />
          <Ellipse cx="152" cy="150" rx="4" ry="11" fill={palette.accentSoft} transform="rotate(58 152 150)" />
        </Svg>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.cardBackdrop}>
      <Svg width="100%" height="100%" viewBox="0 0 360 150" preserveAspectRatio="none">
        <Ellipse cx="54" cy="24" rx="44" ry="24" fill={palette.blobA} opacity="0.82" />
        <Ellipse cx="316" cy="28" rx="58" ry="28" fill={palette.blobB} opacity="0.8" />
        <Path d="M0 110C33 88 78 84 122 96C156 105 204 111 245 101C286 91 325 84 360 92V150H0Z" fill={palette.hillBack} opacity="0.95" />
        <Path d="M0 123C41 111 84 121 131 132C184 145 234 137 360 116V150H0Z" fill={palette.hillFront} />
        <Ellipse cx="56" cy="118" rx="70" ry="34" fill={palette.blobC} opacity="0.48" />
        <Ellipse cx="303" cy="116" rx="82" ry="30" fill={palette.accentSoft} opacity="0.4" />
        <Ellipse cx="87" cy="58" rx="14" ry="30" fill={palette.accent} opacity="0.74" />
        <Ellipse cx="279" cy="63" rx="16" ry="34" fill={palette.treeWarm} opacity="0.72" />
        <Ellipse cx="26" cy="92" rx="10" ry="20" fill={palette.accentSoft} opacity="0.68" transform="rotate(30 26 92)" />
        <Ellipse cx="334" cy="100" rx="10" ry="20" fill={palette.accent} opacity="0.66" transform="rotate(-26 334 100)" />
      </Svg>
    </View>
  );
};

const EditDropButton = ({ fillColor, strokeColor = '#FFFFFF', iconColor = '#FFFFFF', onPress, size = 'large', iconName = 'add' }) => {
  const isSmall = size === 'small';
  const touchStyle = isSmall ? styles.quickStartTouchArea : styles.calendarEditTouchArea;
  const iconStyle = isSmall ? styles.quickStartDropIcon : styles.calendarEditDropIcon;
  const svgWidth = isSmall ? 20 : 34;
  const svgHeight = isSmall ? 20 : 40;
  const iconSize = isSmall ? 8 : 14;

  return (
    <TouchableOpacity
      style={touchStyle}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.dropButtonVisual}>
        <Svg width={svgWidth} height={svgHeight} viewBox="0 0 28 34">
          <Path
            d="M14 3.6C12.25 6.63 7 11.88 7 17.25C7 21.57 10.27 24.6 14 24.6C17.73 24.6 21 21.57 21 17.25C21 11.88 15.75 6.63 14 3.6Z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.35"
          />
        </Svg>
        <View style={iconStyle}>
          <MaterialIcons name={iconName} size={iconSize} color={iconColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const HelpBubbleTail = ({ side, backgroundColor, borderColor }) => {
  const isTop = side === 'top';

  return (
    <View style={isTop ? styles.helpBubbleTailSvgTop : styles.helpBubbleTailSvgBottom}>
      <Svg width={20} height={14} viewBox="0 0 20 14">
        <Path
          d={isTop ? 'M2 14L10 2L18 14Z' : 'M2 0L10 12L18 0Z'}
          fill={backgroundColor}
          stroke={borderColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <Rect
          x="4"
          y={isTop ? '11.4' : '0'}
          width="12"
          height="3"
          fill={backgroundColor}
        />
      </Svg>
    </View>
  );
};

const getConfidenceDescription = (prediction, t) => {
  if (prediction.regularityStatus === 'regular' && prediction.predictionWindowStartText && prediction.predictionWindowEndText) {
    return t('confidence.regular', { start: prediction.predictionWindowStartText, end: prediction.predictionWindowEndText });
  }

  if (prediction.regularityStatus === 'variable' && prediction.predictionWindowStartText && prediction.predictionWindowEndText) {
    return t('confidence.variable', { start: prediction.predictionWindowStartText, end: prediction.predictionWindowEndText });
  }

  if (prediction.regularityStatus === 'irregular' && prediction.predictionWindowStartText && prediction.predictionWindowEndText) {
    return t('confidence.irregular', { start: prediction.predictionWindowStartText, end: prediction.predictionWindowEndText });
  }

  if (prediction.isUsingCustomCycleLength) {
    return t('confidence.custom', { count: prediction.averageCycleLength });
  }

  return t('confidence.fallback');
};

export const HomeScreen = ({ navigation, route }) => {
  const { theme, colors, isMono } = useTheme();
  const { language, supportedLanguages, setLanguage, t } = useLanguage();
  const monthNames = t('calendar.months');
  const weekDayNames = t('calendar.weekdays');
  const affirmations = useMemo(() => getAffirmations(language), [language]);
  const helpTourSteps = useMemo(() => (
    HELP_TOUR_STEP_KEYS.map((step) => ({
      ...step,
      title: t(step.titleKey),
      message: t(step.messageKey),
    }))
  ), [t]);
  const notificationTexts = useMemo(() => ({
    channelName: t('notifications.channelName'),
    periodTitle: t('notifications.periodNotificationTitle'),
    periodBody: t('notifications.periodNotificationBody'),
    ovulationTitle: t('notifications.ovulationNotificationTitle'),
    ovulationBody: t('notifications.ovulationNotificationBody'),
    peakTitle: t('notifications.peakNotificationTitle'),
    peakBody: t('notifications.peakNotificationBody'),
  }), [t]);
  const quotePalette = isMono
    ? theme === 'dark'
      ? {
          card: '#1F2023',
          border: 'rgba(0,0,0,0.88)',
          labelBg: 'rgba(255,255,255,0.12)',
          labelBorder: 'rgba(255,255,255,0.14)',
          labelText: '#ECEFF2',
          bubblePrimary: 'rgba(255,255,255,0.10)',
          bubbleSecondary: 'rgba(184,190,196,0.12)',
          bubbleSoft: 'rgba(255,255,255,0.06)',
          glow: 'rgba(210,214,220,0.14)',
          textBox: 'rgba(24,26,30,0.34)',
          textBorder: 'rgba(255,255,255,0.08)',
          text: '#F7F8F9',
        }
      : {
          card: '#F1F3F5',
          border: '#D6DBE1',
          labelBg: 'rgba(255,255,255,0.24)',
          labelBorder: '#E0E4E8',
          labelText: '#5F6770',
          bubblePrimary: 'rgba(205,210,216,0.46)',
          bubbleSecondary: 'rgba(226,230,234,0.68)',
          bubbleSoft: 'rgba(255,255,255,0.76)',
          glow: 'rgba(229,232,236,0.88)',
          textBox: 'rgba(255,255,255,0.46)',
          textBorder: 'rgba(217,222,228,0.68)',
          text: '#444B53',
        }
    : theme === 'dark'
    ? {
        card: '#231435',
        border: 'rgba(0,0,0,0.88)',
        labelBg: 'rgba(255,255,255,0.14)',
        labelBorder: 'rgba(255,255,255,0.16)',
        labelText: '#F3E9FF',
        bubblePrimary: 'rgba(186, 134, 255, 0.30)',
        bubbleSecondary: 'rgba(109, 77, 168, 0.28)',
        bubbleSoft: 'rgba(255, 255, 255, 0.08)',
        glow: 'rgba(203, 162, 255, 0.34)',
        textBox: 'rgba(30, 18, 44, 0.30)',
        textBorder: 'rgba(255, 255, 255, 0.10)',
        text: '#FFF8FF',
      }
    : {
        card: '#FBF4FF',
        border: '#E6D7F5',
        labelBg: 'rgba(255,255,255,0.22)',
        labelBorder: '#E9D9F8',
        labelText: '#8D56B0',
        bubblePrimary: 'rgba(241, 195, 255, 0.85)',
        bubbleSecondary: 'rgba(206, 182, 255, 0.72)',
        bubbleSoft: 'rgba(255, 255, 255, 0.85)',
        glow: 'rgba(255, 223, 250, 0.95)',
        textBox: 'rgba(255, 255, 255, 0.18)',
        textBorder: 'rgba(230, 215, 245, 0.28)',
        text: '#111111',
      };
  const quoteBackgroundSource = useMemo(() => {
    const currentMoment = new Date();
    const dayPhaseKey = getDayPhaseKey(currentMoment);
    const seasonKey = getSeasonKey(currentMoment);
    return QUOTE_BACKGROUND_IMAGES[dayPhaseKey][seasonKey];
  }, []);
  const quoteImageStyleOverride = isMono
    ? theme === 'dark'
      ? { opacity: 0.82 }
      : { opacity: 0.9 }
    : null;
  const quoteImageVeilColor = isMono
    ? theme === 'dark'
      ? 'rgba(118, 122, 128, 0.42)'
      : 'rgba(246, 247, 249, 0.44)'
    : theme === 'dark'
      ? 'rgba(106, 111, 118, 0.16)'
      : 'rgba(255, 255, 255, 0.16)';
  const quoteScenePalette = isMono
    ? theme === 'dark'
      ? {
          blobA: 'rgba(120,128,138,0.34)',
          blobB: 'rgba(180,186,192,0.18)',
          blobC: 'rgba(92,98,106,0.38)',
          hillBack: 'rgba(110,116,124,0.28)',
          hillFront: 'rgba(70,74,80,0.44)',
          hillSoft: 'rgba(150,156,164,0.20)',
          trunk: 'rgba(24,26,28,0.58)',
          treeWarm: 'rgba(146,152,160,0.30)',
          treeSoft: 'rgba(184,190,196,0.18)',
          treeCool: 'rgba(124,130,136,0.26)',
          accent: 'rgba(214,220,228,0.20)',
          accentSoft: 'rgba(255,255,255,0.12)',
        }
      : {
          blobA: 'rgba(214,220,226,0.58)',
          blobB: 'rgba(238,241,244,0.72)',
          blobC: 'rgba(204,210,216,0.54)',
          hillBack: 'rgba(220,225,230,0.58)',
          hillFront: 'rgba(196,203,210,0.62)',
          hillSoft: 'rgba(234,238,242,0.84)',
          trunk: 'rgba(106,112,118,0.38)',
          treeWarm: 'rgba(208,214,220,0.56)',
          treeSoft: 'rgba(238,241,244,0.92)',
          treeCool: 'rgba(190,196,202,0.58)',
          accent: 'rgba(255,255,255,0.74)',
          accentSoft: 'rgba(223,228,232,0.72)',
        }
    : theme === 'dark'
      ? {
          blobA: 'rgba(125, 87, 188, 0.36)',
          blobB: 'rgba(227, 176, 106, 0.20)',
          blobC: 'rgba(95, 61, 146, 0.38)',
          hillBack: 'rgba(215, 151, 88, 0.18)',
          hillFront: 'rgba(91, 53, 130, 0.42)',
          hillSoft: 'rgba(247, 205, 120, 0.16)',
          trunk: 'rgba(36, 22, 44, 0.56)',
          treeWarm: 'rgba(232, 139, 73, 0.30)',
          treeSoft: 'rgba(180, 148, 90, 0.18)',
          treeCool: 'rgba(120, 93, 70, 0.24)',
          accent: 'rgba(255, 191, 92, 0.28)',
          accentSoft: 'rgba(250, 230, 182, 0.16)',
        }
      : {
          blobA: 'rgba(241, 187, 106, 0.34)',
          blobB: 'rgba(255, 227, 177, 0.62)',
          blobC: 'rgba(236, 163, 93, 0.36)',
          hillBack: 'rgba(236, 194, 128, 0.40)',
          hillFront: 'rgba(217, 147, 86, 0.38)',
          hillSoft: 'rgba(255, 239, 208, 0.84)',
          trunk: 'rgba(126, 80, 51, 0.34)',
          treeWarm: 'rgba(232, 136, 72, 0.44)',
          treeSoft: 'rgba(205, 172, 112, 0.32)',
          treeCool: 'rgba(158, 138, 107, 0.22)',
          accent: 'rgba(255, 180, 70, 0.52)',
          accentSoft: 'rgba(255, 218, 148, 0.44)',
        };
  const sectionCardPalette = isMono
    ? theme === 'dark'
      ? {
          week: { backgroundColor: '#26282C', borderColor: '#707780' },
          ovulation: { backgroundColor: '#212428', borderColor: '#7D858D' },
          period: { backgroundColor: '#2A2326', borderColor: '#8A8087' },
          confidence: { backgroundColor: '#23262B', borderColor: '#76808A' },
        }
      : {
          week: { backgroundColor: '#F3F4F6', borderColor: '#D9DDE2' },
          ovulation: { backgroundColor: '#EFF1F3', borderColor: '#D3D8DE' },
          period: { backgroundColor: '#F4F1F2', borderColor: '#DDD5D8' },
          confidence: { backgroundColor: '#F0F2F5', borderColor: '#D6DCE3' },
        }
    : theme === 'dark'
    ? {
        week: { backgroundColor: '#2A183B', borderColor: '#6E52A5' },
        ovulation: { backgroundColor: '#1D2544', borderColor: '#6E86D6' },
        period: { backgroundColor: '#3A1C31', borderColor: '#B56A9A' },
        confidence: { backgroundColor: '#2C2348', borderColor: '#7E70C9' },
      }
    : {
        week: { backgroundColor: '#FAF2FF', borderColor: '#E6CFF9' },
        ovulation: { backgroundColor: '#EEF4FF', borderColor: '#C8D8FF' },
        period: { backgroundColor: '#FFF0F6', borderColor: '#F3C9DB' },
        confidence: { backgroundColor: '#F4F0FF', borderColor: '#D9D0FF' },
      };
  const weekHighlightPalette = isMono
    ? theme === 'dark'
      ? {
          backgroundColor: '#26282B',
          borderColor: '#AAB0B7',
          shadowColor: '#D5DAE0',
          accentBubble: 'rgba(255,255,255,0.07)',
          accentBubbleSecondary: 'rgba(192,198,205,0.09)',
          dayCellBackground: 'rgba(20, 17, 10, 0.34)',
        }
      : {
          backgroundColor: '#F1F3F5',
          borderColor: '#CCD2D8',
          shadowColor: '#DEE3E8',
          accentBubble: 'rgba(206,211,216,0.38)',
          accentBubbleSecondary: 'rgba(228,232,236,0.56)',
          dayCellBackground: 'rgba(255, 255, 255, 0.50)',
        }
    : theme === 'dark'
      ? {
          backgroundColor: '#2E281D',
          borderColor: '#E7D59E',
          shadowColor: '#F0E5BF',
          accentBubble: 'rgba(255, 235, 170, 0.10)',
          accentBubbleSecondary: 'rgba(255, 247, 220, 0.08)',
          dayCellBackground: 'rgba(20, 17, 10, 0.34)',
        }
      : {
          backgroundColor: '#FFF7DF',
          borderColor: '#E8D59A',
          shadowColor: '#F3E8C2',
          accentBubble: 'rgba(255, 223, 128, 0.42)',
          accentBubbleSecondary: 'rgba(255, 239, 186, 0.52)',
          dayCellBackground: 'rgba(255, 255, 255, 0.50)',
        };
  const weekScenePalette = isMono
    ? theme === 'dark'
      ? {
          blobA: 'rgba(150,156,164,0.12)',
          blobB: 'rgba(214,220,228,0.08)',
          blobC: 'rgba(86,92,98,0.22)',
          hillBack: 'rgba(132,138,146,0.18)',
          hillFront: 'rgba(66,70,76,0.34)',
          accent: 'rgba(218,224,230,0.14)',
          accentSoft: 'rgba(255,255,255,0.08)',
          treeWarm: 'rgba(184,190,198,0.18)',
        }
      : {
          blobA: 'rgba(216,221,226,0.42)',
          blobB: 'rgba(241,243,246,0.88)',
          blobC: 'rgba(202,208,214,0.42)',
          hillBack: 'rgba(214,220,226,0.58)',
          hillFront: 'rgba(196,202,208,0.54)',
          accent: 'rgba(255,255,255,0.60)',
          accentSoft: 'rgba(228,233,238,0.54)',
          treeWarm: 'rgba(206,212,218,0.48)',
        }
    : theme === 'dark'
      ? {
          blobA: 'rgba(255, 235, 170, 0.12)',
          blobB: 'rgba(249, 224, 146, 0.08)',
          blobC: 'rgba(176, 132, 70, 0.20)',
          hillBack: 'rgba(238, 214, 152, 0.18)',
          hillFront: 'rgba(124, 90, 42, 0.28)',
          accent: 'rgba(255, 223, 128, 0.20)',
          accentSoft: 'rgba(255, 244, 206, 0.14)',
          treeWarm: 'rgba(245, 191, 104, 0.20)',
        }
      : {
          blobA: 'rgba(255, 226, 150, 0.36)',
          blobB: 'rgba(255, 245, 209, 0.86)',
          blobC: 'rgba(244, 200, 115, 0.30)',
          hillBack: 'rgba(243, 214, 154, 0.46)',
          hillFront: 'rgba(234, 182, 94, 0.30)',
          accent: 'rgba(255, 207, 92, 0.40)',
          accentSoft: 'rgba(255, 238, 188, 0.42)',
          treeWarm: 'rgba(246, 176, 84, 0.34)',
        };
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompactHome = windowHeight < 760;
  const isRoomyHome = windowHeight >= 840 && windowWidth >= 380;
  const homeLayout = useMemo(() => {
    const usableHeight = Math.max(0, windowHeight - insets.top - insets.bottom - 56);
    const roomyRatio = Math.max(0, Math.min(1, (usableHeight - 560) / 180));
    const tightRatio = Math.max(0, Math.min(1, (660 - usableHeight) / 120));

    return {
      scrollContent: {
        paddingTop: Math.round(8 + (roomyRatio * 8)),
        paddingBottom: Math.max(insets.bottom + 14, Math.round(16 + (roomyRatio * 10))),
      },
      quoteCard: {
        height: Math.round(182 + (roomyRatio * 58) - (tightRatio * 16)),
        marginBottom: Math.round(13 + (roomyRatio * 4)),
      },
      quoteTextShell: {
        minHeight: Math.round(82 + (roomyRatio * 18) - (tightRatio * 6)),
      },
      sectionHeader: {
        marginBottom: Math.round(8 + (roomyRatio * 2)),
      },
      weekCard: {
        padding: Math.round(9 + (roomyRatio * 3)),
      },
      legend: {
        marginTop: 8,
        marginBottom: Math.round(12 + (roomyRatio * 3)),
      },
      statusRow: {
        marginBottom: Math.round(10 + (roomyRatio * 4)),
      },
      statusCard: {
        minHeight: Math.round(92 + (roomyRatio * 18) - (tightRatio * 8)),
      },
      infoCard: {
        padding: Math.round(12 + (roomyRatio * 5)),
        minHeight: Math.round(100 + (roomyRatio * 28) - (tightRatio * 10)),
      },
    };
  }, [insets.bottom, insets.top, windowHeight]);
  const { isLocalMode, user } = useAuth();
  const menuButtonRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const calendarButtonRef = useRef(null);
  const calendarHintRef = useRef(null);
  const quickStartButtonRef = useRef(null);
  const scrollViewRef = useRef(null);
  const notificationScrollRef = useRef(null);
  const [isHomeReady, setHomeReady] = useState(false);
  const [periodLogs, setPeriodLogs] = useState([]);
  const [affirmation, setAffirmation] = useState(affirmations[0] || '');
  const [typedAffirmation, setTypedAffirmation] = useState('');
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isCalendarPanelMounted, setIsCalendarPanelMounted] = useState(false);
  const [isCalendarEditing, setIsCalendarEditing] = useState(false);
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarSelectedDay, setCalendarSelectedDay] = useState(new Date().getDate());
  const [calendarDuration, setCalendarDuration] = useState(5);
  const [isSavingCalendarLog, setIsSavingCalendarLog] = useState(false);
  const [pendingCalendarPayload, setPendingCalendarPayload] = useState(null);
  const [isMultiplePeriodDialogVisible, setMultiplePeriodDialogVisible] = useState(false);
  const [isNotificationPanelVisible, setNotificationPanelVisible] = useState(false);
  const [isOvulationInfoVisible, setOvulationInfoVisible] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isLanguagePickerExpanded, setLanguagePickerExpanded] = useState(false);
  const [cycleSettings, setCycleSettings] = useState(DEFAULT_CYCLE_SETTINGS);
  const [isHelpTourVisible, setHelpTourVisible] = useState(false);
  const [isHelpTourCheckComplete, setHelpTourCheckComplete] = useState(false);
  const [helpTourStepIndex, setHelpTourStepIndex] = useState(0);
  const [helpTourTargets, setHelpTourTargets] = useState({});
  const [helpBubbleHeight, setHelpBubbleHeight] = useState(HELP_TOUR_BODY_ESTIMATED_HEIGHT);
  const handledHelpTourNonceRef = useRef(null);
  const quoteTimersRef = useRef([]);
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslate = useRef(new Animated.Value(12)).current;
  const quoteTextShellAnim = useRef(new Animated.Value(0)).current;
  const quoteTextRestOpacity = useRef(new Animated.Value(1)).current;
  const calendarPanelAnim = useRef(new Animated.Value(0)).current;
  const calendarStartPulseAnim = useRef(new Animated.Value(0)).current;
  const startIndicatorColor = theme === 'dark' ? '#FFFFFF' : '#111111';

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const loadPeriodLogs = useCallback(async () => {
    const logs = isLocalMode
      ? await getLocalPeriodLogs()
      : user?.id
        ? await getPeriodLogs({ userId: user.id })
        : [];

    setPeriodLogs(logs);
    setAffirmation(affirmations[Math.floor(Math.random() * affirmations.length)] || '');
    setHomeReady(true);
  }, [affirmations, isLocalMode, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadPeriodLogs().catch((error) => {
        console.error('Döngü kayıtları okunamadı:', error);
      });
    }, [loadPeriodLogs])
  );

  useEffect(() => {
    getNotificationPreferences()
      .then(setNotificationPreferences)
      .catch((error) => {
        console.error('Bildirim tercihleri okunamadı:', error);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkFirstHelpTour = async () => {
      try {
        const completed = await AsyncStorage.getItem(HOME_TOUR_COMPLETED_KEY);
        if (!completed && isMounted) {
          setHelpTourTargets({});
          setHelpTourStepIndex(0);
          setHelpTourVisible(true);
        }
      } catch (error) {
        console.error('Yardım turu durumu okunamadı:', error);
      } finally {
        if (isMounted) {
          setHelpTourCheckComplete(true);
        }
      }
    };

    checkFirstHelpTour();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    getCycleSettings()
      .then((settings) => {
        setCycleSettings(settings);
        setCalendarDuration(settings.periodLength || 5);
      })
      .catch((error) => {
        console.error('Döngü ayarları okunamadı:', error);
      });
  }, []);

  useEffect(() => {
    if (!isNotificationPanelVisible) {
      setLanguagePickerExpanded(false);
    }
  }, [isNotificationPanelVisible]);

  useEffect(() => {
    introOpacity.setValue(0);
    introTranslate.setValue(12);

    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(introTranslate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [introOpacity, introTranslate]);

  useEffect(() => {
    quoteTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    quoteTimersRef.current = [];

    quoteTextShellAnim.stopAnimation();
    quoteTextRestOpacity.stopAnimation();
    setTypedAffirmation('');
    quoteTextShellAnim.setValue(0);
    quoteTextRestOpacity.setValue(1);

    if (!isHelpTourCheckComplete || isHelpTourVisible) {
      return () => {
        quoteTimersRef.current.forEach((timerId) => clearTimeout(timerId));
        quoteTimersRef.current = [];
      };
    }

    Animated.timing(quoteTextShellAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const typingStartDelay = 700;
    const typingDuration = 4600;
    const totalCharacters = Math.max(affirmation.length, 1);
    const typeStepDuration = Math.max(55, Math.round(typingDuration / totalCharacters));

    const typingTimeout = setTimeout(() => {
      let characterIndex = 0;
      const typeNextCharacter = () => {
        characterIndex += 1;
        setTypedAffirmation(affirmation.slice(0, characterIndex));

        if (characterIndex < affirmation.length) {
          const nextTimeout = setTimeout(typeNextCharacter, typeStepDuration);
          quoteTimersRef.current.push(nextTimeout);
          return;
        }

        const softenTimeout = setTimeout(() => {
          Animated.timing(quoteTextRestOpacity, {
            toValue: 0.68,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start();
        }, 5000);

        quoteTimersRef.current.push(softenTimeout);
      };

      typeNextCharacter();
    }, typingStartDelay);

    quoteTimersRef.current.push(typingTimeout);

    return () => {
      quoteTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      quoteTimersRef.current = [];
    };
  }, [affirmation, isHelpTourCheckComplete, isHelpTourVisible, quoteTextRestOpacity, quoteTextShellAnim]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(calendarStartPulseAnim, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(calendarStartPulseAnim, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [calendarStartPulseAnim]);

  useEffect(() => {
    if (!isCalendarExpanded || !isCalendarEditing) return;
    calendarStartPulseAnim.setValue(0);
  }, [calendarSelectedDay, calendarStartPulseAnim, isCalendarEditing, isCalendarExpanded]);

  useEffect(() => {
    if (isCalendarExpanded) {
      setIsCalendarPanelMounted(true);
      Animated.timing(calendarPanelAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!isCalendarPanelMounted) {
      calendarPanelAnim.setValue(0);
      return;
    }

    Animated.timing(calendarPanelAnim, {
      toValue: 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsCalendarPanelMounted(false);
      }
    });
  }, [calendarPanelAnim, isCalendarExpanded, isCalendarPanelMounted]);

  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const cyclePrediction = useMemo(() => getCyclePrediction({
    logs: periodLogs,
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
    today,
    fallbackCycleLength: cycleSettings.averageCycleLength,
  }), [cycleSettings.averageCycleLength, periodLogs, today]);

  useEffect(() => {
    const hasEnabledNotification = Object.values(notificationPreferences).some(Boolean);
    if (!hasEnabledNotification || !periodLogs.length) return;

    rescheduleCycleNotifications({
      preferences: notificationPreferences,
      prediction: cyclePrediction,
      texts: notificationTexts,
    }).catch((error) => {
      console.error('Bildirim planı güncellenemedi:', error);
    });
  }, [cyclePrediction, notificationPreferences, notificationTexts, periodLogs.length]);

  const periodStatus = useMemo(() => getCurrentPeriodStatus({
    logs: periodLogs,
    prediction: cyclePrediction,
    today,
    t,
  }), [cyclePrediction, periodLogs, t, today]);

  const ovulationStatus = useMemo(() => getOvulationStatus({
    prediction: cyclePrediction,
    today,
    t,
  }), [cyclePrediction, t, today]);

  const weekRangeLabel = useMemo(() => getWeekRangeLabel(weekDates, monthNames), [monthNames, weekDates]);
  const calendarYear = calendarMonthDate.getFullYear();
  const calendarMonth = calendarMonthDate.getMonth();
  const calendarDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarStartSpace = new Date(calendarYear, calendarMonth, 1).getDay() === 0
    ? 6
    : new Date(calendarYear, calendarMonth, 1).getDay() - 1;
  const earliestCalendarMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 5, 1), [today]);
  const latestCalendarMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 2, 1), [today]);
  const canGoPreviousMonth = calendarMonthDate > earliestCalendarMonth;
  const canGoNextMonth = calendarMonthDate < latestCalendarMonth;
  const calendarSelectedDays = useMemo(() => (
    Array.from({ length: calendarDuration }, (_, index) => calendarSelectedDay + index)
      .filter((day) => day <= calendarDaysInMonth)
  ), [calendarDaysInMonth, calendarDuration, calendarSelectedDay]);
  const selectedCalendarStartDate = useMemo(() => (
    toDateTextFromParts(calendarYear, calendarMonth, calendarSelectedDay)
  ), [calendarMonth, calendarSelectedDay, calendarYear]);
  const selectedCalendarLog = useMemo(() => (
    periodLogs.find((log) => log.start_date === selectedCalendarStartDate || log.selected_dates?.includes(selectedCalendarStartDate))
  ), [periodLogs, selectedCalendarStartDate]);
  const calendarMonthLog = useMemo(() => {
    const monthKey = selectedCalendarStartDate.slice(0, 7);
    return periodLogs.find((log) => log.start_date?.startsWith(monthKey));
  }, [periodLogs, selectedCalendarStartDate]);
  const calendarWeeks = useMemo(() => {
    const items = [
      ...Array(calendarStartSpace).fill(null),
      ...Array.from({ length: calendarDaysInMonth }, (_, index) => index + 1),
    ];
    const filled = [
      ...items,
      ...Array((7 - (items.length % 7)) % 7).fill(null),
    ];
    const rows = [];
    for (let i = 0; i < filled.length; i += 7) {
      rows.push(filled.slice(i, i + 7));
    }
    return rows;
  }, [calendarDaysInMonth, calendarStartSpace]);

  const handleCalendarMonthChange = (offset) => {
    setCalendarMonthDate((currentDate) => {
      const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
      const nextDaysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      const maxSelectableDay = nextDate.getFullYear() === today.getFullYear() && nextDate.getMonth() === today.getMonth()
        ? Math.min(today.getDate(), nextDaysInMonth)
        : nextDaysInMonth;
      setCalendarSelectedDay((day) => Math.min(day, maxSelectableDay));
      return nextDate;
    });
  };

  const handleCalendarDurationChange = (nextDuration) => {
    setCalendarDuration(nextDuration);
    saveCycleSettings({
      averageCycleLength: cycleSettings.averageCycleLength,
      periodLength: nextDuration,
    })
      .then(setCycleSettings)
      .catch((error) => {
        console.error('Regl süresi tercihi kaydedilemedi:', error);
      });
  };

  const persistCalendarLog = async (payload) => {
    if (!isLocalMode && !user?.id) return;

    setIsSavingCalendarLog(true);

    if (isLocalMode) {
      await replaceLocalPeriodLog(payload);
    } else {
      await replacePeriodLog({ userId: user.id, ...payload });
    }

    const nextSettings = await saveCycleSettings({
      averageCycleLength: cycleSettings.averageCycleLength,
      periodLength: calendarDuration,
    });
    setCycleSettings(nextSettings);

    await loadPeriodLogs();
    setIsCalendarEditing(false);
  };

  const handleSaveCalendarLog = async () => {
    if (!isLocalMode && !user?.id) return;
    if (new Date(calendarYear, calendarMonth, calendarSelectedDay) > today) return;

    try {
      const payload = {
        year: calendarYear,
        monthIndex: calendarMonth,
        startDay: calendarSelectedDay,
        duration: calendarDuration,
        selectedDays: calendarSelectedDays,
        hasStarted: true,
        flowStatus: 'orta',
        painLevel: 'yok',
      };
      const sameMonthLogs = periodLogs.filter((log) => (
        log.start_date?.startsWith(selectedCalendarStartDate.slice(0, 7))
        && log.start_date !== selectedCalendarStartDate
      ));

      if (sameMonthLogs.length > 0) {
        setPendingCalendarPayload(payload);
        setMultiplePeriodDialogVisible(true);
        return;
      }

      await persistCalendarLog(payload);
    } catch (error) {
      console.error('Geçmiş regl kaydı güncellenemedi:', error);
    } finally {
      setIsSavingCalendarLog(false);
    }
  };

  const handleConfirmMultiplePeriodLog = async () => {
    if (!pendingCalendarPayload) return;

    try {
      setMultiplePeriodDialogVisible(false);
      await persistCalendarLog(pendingCalendarPayload);
    } catch (error) {
      console.error('Aynı ay için ikinci regl kaydı eklenemedi:', error);
    } finally {
      setPendingCalendarPayload(null);
      setIsSavingCalendarLog(false);
    }
  };

  const handleDeleteCalendarLog = async () => {
    if (!selectedCalendarLog) return;
    if (!isLocalMode && !user?.id) return;

    try {
      setIsSavingCalendarLog(true);

      if (isLocalMode) {
        await deleteLocalPeriodLogByStartDate(selectedCalendarLog.start_date);
      } else {
        await deletePeriodLogByStartDate({ userId: user.id, startDate: selectedCalendarLog.start_date });
      }

      await loadPeriodLogs();
    } catch (error) {
      console.error('Geçmiş regl kaydı silinemedi:', error);
    } finally {
      setIsSavingCalendarLog(false);
    }
  };

  const handleClearCalendarMonth = async () => {
    if (!calendarMonthLog) return;
    if (!isLocalMode && !user?.id) return;

    try {
      setIsSavingCalendarLog(true);

      if (isLocalMode) {
        await deleteLocalPeriodLogsByMonth(calendarYear, calendarMonth);
      } else {
        await deletePeriodLogsByMonth({ userId: user.id, year: calendarYear, monthIndex: calendarMonth });
      }

      await loadPeriodLogs();
    } catch (error) {
      console.error('Ay kaydı temizlenemedi:', error);
    } finally {
      setIsSavingCalendarLog(false);
    }
  };

  const handleOpenCalendar = () => {
    calendarStartPulseAnim.setValue(0);
    setCalendarMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setCalendarSelectedDay(today.getDate());
    setIsCalendarEditing(false);
    setIsCalendarExpanded(true);
  };

  const handleCloseCalendar = () => {
    setIsCalendarExpanded(false);
    setIsCalendarEditing(false);
  };

  const handleToggleCalendarEditing = () => {
    calendarStartPulseAnim.setValue(0);
    setIsCalendarEditing((value) => !value);
  };

  const handleStartPeriodFromCalendar = () => {
    calendarStartPulseAnim.setValue(0);
    setCalendarMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const preferredDuration = cycleSettings.periodLength || 5;
    setCalendarSelectedDay(today.getDate());
    setCalendarDuration(preferredDuration);
    setIsCalendarExpanded(true);
    setIsCalendarEditing(true);
  };

  const handleToggleNotification = async (key) => {
    const nextValue = !notificationPreferences[key];

    if (nextValue) {
      if (!isNotificationFeatureAvailable) {
        setNotificationMessage(t('notifications.expoUnsupported'));
        return;
      }

      const hasPermission = await ensureNotificationPermission(notificationTexts);
      if (!hasPermission) {
        setNotificationMessage(t('notifications.permissionDenied'));
        return;
      }
    }

    const nextPreferences = {
      ...notificationPreferences,
      [key]: nextValue,
    };

    try {
      setNotificationPreferences(nextPreferences);
      await saveNotificationPreferences(nextPreferences);
      await rescheduleCycleNotifications({
        preferences: nextPreferences,
        prediction: cyclePrediction,
        texts: notificationTexts,
      });
      setNotificationMessage(nextValue ? t('notifications.saved') : t('notifications.disabled'));
    } catch (error) {
      console.error('Bildirim tercihi kaydedilemedi:', error);
      setNotificationMessage(t('notifications.saveFailed'));
    }
  };

  const handleCycleLengthChange = async (offset) => {
    const currentAverageCycleLength = Number(cycleSettings.averageCycleLength) || DEFAULT_CYCLE_SETTINGS.averageCycleLength;
    const nextAverageCycleLength = getClampedCycleLength(currentAverageCycleLength + offset);

    try {
      const nextSettings = await saveCycleSettings({ averageCycleLength: nextAverageCycleLength });
      setCycleSettings(nextSettings);
      setNotificationMessage(t('notifications.cycleUpdated'));
    } catch (error) {
      console.error('Döngü ayarı kaydedilemedi:', error);
      setNotificationMessage(t('notifications.cycleUpdateFailed'));
    }
  };

  const handleToggleLanguagePicker = () => {
    setLanguagePickerExpanded((value) => {
      const nextValue = !value;
      if (nextValue) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            notificationScrollRef.current?.scrollToEnd?.({ animated: true });
          }, 80);
        });
      }
      return nextValue;
    });
  };

  useEffect(() => {
    const nonce = route?.params?.helpTourNonce;
    if (!nonce || nonce === handledHelpTourNonceRef.current) return;

    handledHelpTourNonceRef.current = nonce;
    setNotificationPanelVisible(false);
    setIsCalendarEditing(false);
    setIsCalendarExpanded(false);
    setHelpTourTargets({});
    setHelpTourStepIndex(0);

    const delayMs = Number(route?.params?.helpTourStartDelayMs || 0);
    const timerId = setTimeout(() => {
      setHelpTourVisible(true);
    }, Math.max(0, delayMs));

    return () => clearTimeout(timerId);
  }, [route?.params?.helpTourNonce, route?.params?.helpTourStartDelayMs]);

  const handleToggleOvulationInfo = useCallback(() => {
    setOvulationInfoVisible((current) => !current);
  }, []);

  const closeHelpTour = useCallback(async () => {
    setHelpTourVisible(false);
    setHelpTourStepIndex(0);
    try {
      await AsyncStorage.setItem(HOME_TOUR_COMPLETED_KEY, '1');
    } catch (error) {
      console.error('Yardım turu durumu kaydedilemedi:', error);
    }
  }, []);

  const handleNextHelpStep = useCallback(() => {
    if (helpTourStepIndex >= helpTourSteps.length - 1) {
      closeHelpTour();
      return;
    }

    setHelpTourTargets({});
    setHelpTourStepIndex((value) => value + 1);
  }, [closeHelpTour, helpTourStepIndex, helpTourSteps.length]);

  const currentHelpStep = helpTourSteps[helpTourStepIndex] || helpTourSteps[0];
  const hasMeasuredCurrentHelpTarget = Boolean(helpTourTargets[currentHelpStep.key]);
  const measureHelpTarget = useCallback((key, targetRef) => {
    if (!targetRef?.current?.measureInWindow) return;

    requestAnimationFrame(() => {
      targetRef.current.measureInWindow((x, y, width, height) => {
        if (!width || !height) return;
        setHelpTourTargets((current) => ({
          ...current,
          [key]: { x, y, width, height },
        }));
      });
    });
  }, []);

  useEffect(() => {
    if (!isHelpTourVisible) return;

    const measureAllTargets = () => {
      measureHelpTarget('menu', menuButtonRef);
      measureHelpTarget('settings', settingsButtonRef);
      measureHelpTarget('calendar', calendarButtonRef);
      measureHelpTarget('quickStart', quickStartButtonRef);
    };

    const firstTimeoutId = setTimeout(measureAllTargets, 60);
    const intervalId = setInterval(measureAllTargets, 180);
    const stopTimeoutId = setTimeout(() => clearInterval(intervalId), 2200);

    return () => {
      clearTimeout(firstTimeoutId);
      clearInterval(intervalId);
      clearTimeout(stopTimeoutId);
    };
  }, [isHelpTourVisible, helpTourStepIndex, isCalendarExpanded, measureHelpTarget]);

  const helpStepLayout = useMemo(() => {
    const target = helpTourTargets[currentHelpStep.key];
    if (!target) {
      const fallbackLeft = currentHelpStep.placement === 'topRight'
        ? Math.max(12, windowWidth - HELP_TOUR_CARD_WIDTH - 12)
        : currentHelpStep.placement === 'center'
          ? Math.max(12, (windowWidth - HELP_TOUR_CARD_WIDTH) / 2)
          : 12;
      const fallbackTop = currentHelpStep.placement === 'center'
        ? Math.min(windowHeight - 170, 330)
        : insets.top + 64;
      return {
        positionStyle: {
          left: fallbackLeft,
          top: fallbackTop,
          alignItems: currentHelpStep.placement === 'topRight' ? 'flex-end' : currentHelpStep.placement === 'center' ? 'center' : 'flex-start',
        },
        tailTipX: 120,
        tailOnTop: currentHelpStep.key !== 'calendar',
      };
    }

    const centeredLeft = target.x + (target.width / 2) - (HELP_TOUR_CARD_WIDTH / 2);
    const left = Math.max(12, Math.min(windowWidth - HELP_TOUR_CARD_WIDTH - 12, centeredLeft));
    const preferredTop = currentHelpStep.key === 'calendar'
      ? target.y - helpBubbleHeight - HELP_TOUR_TARGET_GAP + HELP_TOUR_VERTICAL_OFFSETS.calendar
      : target.y + target.height + HELP_TOUR_TAIL_OUTER_SIZE + HELP_TOUR_TARGET_GAP + (HELP_TOUR_VERTICAL_OFFSETS[currentHelpStep.key] || 0);
    const top = Math.max(insets.top + 8, Math.min(windowHeight - 170, preferredTop));

    const targetCenterX = target.x + (target.width / 2);
    const tailTipX = Math.max(10, Math.min(HELP_TOUR_CARD_WIDTH - 10, targetCenterX - left));

    return {
      positionStyle: {
        left,
        top,
        alignItems: currentHelpStep.placement === 'topRight' ? 'flex-end' : currentHelpStep.placement === 'topLeft' ? 'flex-start' : 'center',
      },
      tailTipX,
      tailOnTop: currentHelpStep.key !== 'calendar',
    };
  }, [currentHelpStep.key, currentHelpStep.placement, helpBubbleHeight, helpTourTargets, insets.top, windowHeight, windowWidth]);

  const calendarPanelAnimatedStyle = {
    opacity: calendarPanelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: calendarPanelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
      {
        scale: calendarPanelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };
  const calendarBackdropAnimatedStyle = {
    opacity: calendarPanelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  const calendarStartPulseStyle = {
    opacity: calendarStartPulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 1],
    }),
    transform: [
      {
        scale: calendarStartPulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1.12],
        }),
      },
    ],
  };
  const quoteTextShellAnimatedStyle = {
    opacity: Animated.multiply(quoteTextShellAnim, quoteTextRestOpacity),
    width: '100%',
    transform: [
      {
        translateY: quoteTextShellAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  const renderWeekDay = (date, index) => {
    const dateText = toDateText(date);
    const isToday = dateText === toDateText(today);
    const isPeriod = cyclePrediction.actualPeriodDates?.has(dateText)
      || cyclePrediction.predictedPeriodDates?.has(dateText);
    const isOvulationPeak = cyclePrediction.ovulationPeakDates?.has(dateText);
    const isFertile = cyclePrediction.fertileDates?.has(dateText);
    const isMarked = isPeriod || isOvulationPeak || isFertile;
    const backgroundColor = isPeriod
      ? colors.period
      : isOvulationPeak
        ? '#D4A017'
        : isFertile
        ? colors.ovulation
        : 'transparent';

    return (
      <TouchableOpacity key={dateText} style={styles.weekColumn} activeOpacity={0.8}>
        <Text style={[styles.weekDayName, { color: colors.secondary }]}>{weekDayNames[index]}</Text>
        <View
          style={[
            styles.weekDayBubble,
            {
              backgroundColor: isMarked ? backgroundColor : weekHighlightPalette.dayCellBackground,
              borderColor: isMarked ? (theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.28)') : colors.outline,
            },
          ]}
        >
          <View style={isToday ? [styles.todayNumberBadge, { borderColor: theme === 'dark' ? '#FFFFFF' : '#000000' }] : null}>
            <Text
              style={[
                styles.weekDayNumber,
                { color: isMarked ? colors.black : colors.primary },
                !isMarked && theme === 'dark' && styles.weekDayNumberGlow,
                isToday && styles.todayNumber,
              ]}
            >
              {date.getDate()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isHomeReady) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]} />
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.screenContent,
          {
            opacity: introOpacity,
            transform: [{ translateY: introTranslate }],
          },
        ]}
      >
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View ref={menuButtonRef} collapsable={false}>
            <TouchableOpacity onPress={() => navigation.openDrawer()}>
              <MaterialIcons name="menu" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>OwnApp</Text>
          <View ref={settingsButtonRef} collapsable={false}>
            <TouchableOpacity onPress={() => setNotificationPanelVisible(true)}>
              <MaterialIcons name="settings" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            isRoomyHome && styles.scrollContentRoomy,
            isCompactHome && styles.scrollContentCompact,
            { paddingBottom: Math.max(insets.bottom + 16, isCompactHome ? 20 : 24) },
            homeLayout.scrollContent,
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          bounces={false}
        >
        <View style={[styles.quoteCard, isRoomyHome && styles.quoteCardRoomy, isCompactHome && styles.quoteCardCompact, homeLayout.quoteCard, { backgroundColor: quotePalette.card, borderColor: quotePalette.border }]}>
          <ImageBackground
            source={quoteBackgroundSource}
            resizeMode="cover"
            style={styles.quoteImageBackground}
            imageStyle={[styles.quoteImageStyle, quoteImageStyleOverride]}
          >
            <View style={[styles.quoteImageVeil, { backgroundColor: quoteImageVeilColor }]} />
            <View style={styles.quoteContent}>
              <Animated.View style={quoteTextShellAnimatedStyle}>
                <View style={[styles.quoteTextShell, isCompactHome && styles.quoteTextShellCompact, isRoomyHome && styles.quoteTextShellRoomy, homeLayout.quoteTextShell, { backgroundColor: quotePalette.textBox, borderColor: quotePalette.textBorder }]}>
                  <Text style={[styles.quoteText, isCompactHome && styles.quoteTextCompact, isRoomyHome && styles.quoteTextRoomy, { color: quotePalette.text }]}>
                    "{typedAffirmation}"
                  </Text>
                </View>
              </Animated.View>
            </View>
          </ImageBackground>
        </View>

        <View style={[styles.sectionHeader, isRoomyHome && styles.sectionHeaderRoomy, isCompactHome && styles.sectionHeaderCompact, homeLayout.sectionHeader]}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{t('home.thisWeek')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.secondary }]}>
            {weekRangeLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.weekCard,
            isRoomyHome && styles.weekCardRoomy,
            isCompactHome && styles.weekCardCompact,
            homeLayout.weekCard,
            sectionCardPalette.week,
            {
              backgroundColor: weekHighlightPalette.backgroundColor,
              borderColor: weekHighlightPalette.borderColor,
              shadowColor: weekHighlightPalette.shadowColor,
            },
          ]}
          activeOpacity={0.9}
          onPress={isCalendarExpanded ? handleCloseCalendar : handleOpenCalendar}
        >
          <View style={[styles.weekCardGlow, { backgroundColor: weekHighlightPalette.accentBubble }]} />
          <View style={[styles.weekCardGlowSecondary, { backgroundColor: weekHighlightPalette.accentBubbleSecondary }]} />
          <View style={styles.weekRow}>
            {weekDates.map(renderWeekDay)}
          </View>
          <View ref={calendarHintRef} collapsable={false} style={styles.weekHintRow}>
            <TouchableOpacity
              ref={calendarButtonRef}
              collapsable={false}
              style={[
                styles.weekHintCapsuleButton,
                { borderColor: colors.outline, backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(120,120,120,0.10)' },
              ]}
              activeOpacity={0.85}
              onPress={(event) => {
                event?.stopPropagation?.();
                isCalendarExpanded ? handleCloseCalendar() : handleOpenCalendar();
              }}
            >
              <View style={[styles.weekHintIconBadge, { borderColor: colors.outline, backgroundColor: colors.softCardStrong }]}>
                <MaterialIcons name="calendar-today" size={16} color={colors.secondary} />
                <View style={styles.weekHintArrowLayer}>
                  <MaterialIcons
                    name={isCalendarExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={12}
                    color={colors.secondary}
                  />
                </View>
              </View>
              <Text style={[styles.weekHint, { color: colors.secondary }]}>{isCalendarExpanded ? t('home.closeCalendar') : t('home.openCalendar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              ref={quickStartButtonRef}
              collapsable={false}
              style={[
                styles.weekHintCapsuleButton,
                {
                  borderColor: colors.outline,
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(120,120,120,0.10)',
                  opacity: isCalendarExpanded ? 0.42 : 1,
                },
              ]}
              activeOpacity={0.85}
              disabled={isCalendarExpanded}
              onPress={(event) => {
                if (isCalendarExpanded) return;
                event?.stopPropagation?.();
                handleStartPeriodFromCalendar();
              }}
            >
              <View style={[styles.weekHintIconBadge, { borderColor: colors.outline, backgroundColor: colors.softCardStrong }]}>
                <EditDropButton
                  size="small"
                  fillColor="#C94A5C"
                  iconName="add"
                  onPress={handleStartPeriodFromCalendar}
                />
              </View>
              <Text style={[styles.quickStartText, { color: colors.secondary }]}>{t('home.startPeriod')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {isCalendarPanelMounted && (
          <Modal
            visible={isCalendarPanelMounted}
            transparent
            animationType="none"
            onRequestClose={handleCloseCalendar}
          >
            <Pressable style={styles.calendarOverlayBackdrop} onPress={handleCloseCalendar}>
              <Animated.View pointerEvents="none" style={[styles.calendarOverlayBackdropTint, calendarBackdropAnimatedStyle]} />
              <Animated.View
                pointerEvents={isCalendarExpanded ? 'auto' : 'none'}
                style={[styles.calendarOverlayPanelAnimated, calendarPanelAnimatedStyle]}
              >
                <Pressable style={styles.calendarOverlayPressable} onPress={(event) => event?.stopPropagation?.()}>
                  <ScrollView
                    style={styles.calendarOverlayScroll}
                    contentContainerStyle={styles.calendarOverlayScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
          <View
            style={[styles.expandedCalendarPanel, { backgroundColor: colors.softCard, borderColor: colors.outline }]}
          >
            <View style={styles.expandedCalendarHeader}>
              <TouchableOpacity
                style={[styles.calendarIconButton, { backgroundColor: colors.softCardStrong, borderColor: colors.outline }]}
                onPress={handleCloseCalendar}
              >
                <MaterialIcons name="close" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.calendarModalTitle, { color: colors.primary }]}>{t('home.cycleCalendar')}</Text>
              <TouchableOpacity
                style={[
                  styles.calendarIconButton,
                  {
                    backgroundColor: isCalendarEditing
                      ? (theme === 'light' ? '#000000' : '#FFFFFF')
                      : colors.softCardStrong,
                    borderColor: isCalendarEditing ? '#FFFFFF' : colors.outline,
                  },
                ]}
                onPress={handleToggleCalendarEditing}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name="edit"
                  size={18}
                  color={isCalendarEditing ? (theme === 'light' ? '#FFFFFF' : '#B63F53') : colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarMonthHeader}>
              <TouchableOpacity
                style={[styles.monthArrow, { borderColor: colors.outline, opacity: canGoPreviousMonth ? 1 : 0.35 }]}
                disabled={!canGoPreviousMonth}
                onPress={() => handleCalendarMonthChange(-1)}
              >
                <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthTitle, { color: colors.primary }]}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity
                style={[styles.monthArrow, { borderColor: colors.outline, opacity: canGoNextMonth ? 1 : 0.35 }]}
                disabled={!canGoNextMonth}
                onPress={() => handleCalendarMonthChange(1)}
              >
                <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarRow}>
              {weekDayNames.map((day) => (
                <View key={day} style={styles.calendarColumn}>
                  <Text style={[styles.modalWeekDayName, { color: colors.secondary }]}>{day}</Text>
                </View>
              ))}
            </View>

            {calendarWeeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.calendarRow}>
                {week.map((day, dayIndex) => {
                  const dateText = day ? toDateText(new Date(calendarYear, calendarMonth, day)) : null;
                  const isToday = dateText === toDateText(today);
                  const isFutureDay = day && new Date(calendarYear, calendarMonth, day) > today;
                  const isFutureDisabledForEditing = isFutureDay && isCalendarEditing;
                  const isSelected = day && isCalendarEditing && calendarSelectedDays.includes(day);
                  const isSelectedStart = day && isCalendarEditing && day === calendarSelectedDay;
                  const isActualPeriod = dateText && cyclePrediction.actualPeriodDates?.has(dateText);
                  const isPredictedPeriod = dateText && cyclePrediction.predictedPeriodDates?.has(dateText);
                  const isOvulationPeak = cyclePrediction.ovulationPeakDates?.has(dateText);
                  const isFertile = dateText && cyclePrediction.fertileDates?.has(dateText);
                  const isMarked = isSelected || isActualPeriod || isPredictedPeriod || isOvulationPeak || isFertile;
                  const backgroundColor = isSelected
                    ? colors.period
                    : isActualPeriod || isPredictedPeriod
                      ? colors.period
                      : isOvulationPeak
                        ? '#D4A017'
                        : isFertile
                          ? colors.ovulation
                          : day
                            ? 'transparent'
                            : 'transparent';

                  return (
                    <TouchableOpacity
                      key={`${weekIndex}-${dayIndex}`}
                      style={[styles.calendarColumn, !day && styles.emptyCalendarColumn]}
                      disabled={!day || isFutureDisabledForEditing || !isCalendarEditing}
                      onPress={() => setCalendarSelectedDay(day)}
                    >
                      <View
                        style={[
                          styles.modalDayBubble,
                          {
                            backgroundColor,
                            borderColor: isMarked ? (theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.28)') : colors.outline,
                            opacity: isFutureDisabledForEditing ? 0.35 : 1,
                          },
                          isSelected && { borderWidth: 2.5, borderColor: startIndicatorColor },
                          isSelectedStart && {
                            borderWidth: 3.5,
                            borderColor: startIndicatorColor,
                          },
                        ]}
                      >
                        {day && isSelectedStart ? (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.modalStartDayBadge,
                              {
                                backgroundColor: theme === 'dark' ? '#FFFFFF' : '#111111',
                                borderColor: theme === 'dark' ? '#111111' : '#FFFFFF',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalStartDayBadgeText,
                                {
                                  color: theme === 'dark' ? '#111111' : '#FFFFFF',
                                },
                              ]}
                            >
                              {t('home.start')}
                            </Text>
                          </View>
                        ) : null}
                        {day && (
                          <View
                            style={[
                              styles.modalDayNumberLayer,
                              isToday
                                ? [
                                    styles.todayNumberBadge,
                                    styles.modalTodayNumberBadge,
                                    { borderColor: theme === 'dark' ? '#FFFFFF' : '#000000' },
                                  ]
                                : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalDayText,
                                {
                                  color: isSelectedStart
                                    ? theme === 'dark'
                                      ? '#111111'
                                      : '#FFFFFF'
                                    : isMarked
                                      ? colors.black
                                      : colors.primary,
                                },
                                isOvulationPeak && !isToday && !isSelectedStart && { color: colors.white },
                                isToday && !isSelectedStart && { color: theme === 'light' ? colors.primary : colors.white, fontWeight: '900' },
                                isSelectedStart && { fontWeight: '900' },
                              ]}
                            >
                              {day}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {isCalendarEditing && (
              <View style={[styles.editorCard, { backgroundColor: colors.softCardStrong, borderColor: colors.outline }]}>
                <Text style={[styles.editorTitle, { color: colors.primary }]}>{t('home.periodHistory')}</Text>
                <Text style={[styles.editorText, { color: colors.secondary }]}>
                  {calendarMonthLog
                    ? t('home.periodHistoryReplace')
                    : t('home.periodHistoryNew')}
                </Text>
                <View style={styles.durationSelector}>
                  {[2, 3, 4, 5, 6, 7].map((dayCount) => (
                    <TouchableOpacity
                      key={dayCount}
                      onPress={() => handleCalendarDurationChange(dayCount)}
                      style={[
                        styles.durationButton,
                        { borderColor: colors.outline, backgroundColor: colors.softCard },
                        calendarDuration === dayCount && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.durationText, { color: calendarDuration === dayCount ? colors.background : colors.primary }]}>
                        {dayCount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.saveCalendarButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveCalendarLog}
                  disabled={isSavingCalendarLog}
                >
                  <Text style={[styles.saveCalendarText, { color: colors.background }]}>
                    {isSavingCalendarLog ? t('common.saving') : t('home.saveToCalendar')}
                  </Text>
                </TouchableOpacity>
                {selectedCalendarLog && (
                  <TouchableOpacity
                    style={[styles.deleteCalendarButton, { borderColor: colors.error }]}
                    onPress={handleDeleteCalendarLog}
                    disabled={isSavingCalendarLog}
                  >
                    <MaterialIcons name="delete-outline" size={17} color={colors.error} />
                    <Text style={[styles.deleteCalendarText, { color: colors.error }]}>{t('home.deleteRecord')}</Text>
                  </TouchableOpacity>
                )}
                {calendarMonthLog && (
                  <TouchableOpacity
                    style={[styles.clearCalendarButton, { borderColor: colors.outline, backgroundColor: colors.softCard }]}
                    onPress={handleClearCalendarMonth}
                    disabled={isSavingCalendarLog}
                  >
                    <MaterialIcons name="cleaning-services" size={16} color={colors.primary} />
                    <Text style={[styles.clearCalendarText, { color: colors.primary }]}>{t('home.clearMonth')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

          </View>
                  </ScrollView>
                </Pressable>
              </Animated.View>
            </Pressable>
          </Modal>
        )}

        <View style={[styles.legend, isRoomyHome && styles.legendRoomy, isCompactHome && styles.legendCompact, homeLayout.legend]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.period }]} />
            <Text style={[styles.legendText, { color: colors.secondary }]}>{t('home.period')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.ovulation }]} />
            <Text style={[styles.legendText, { color: colors.secondary }]}>{t('home.fertile')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D4A017' }]} />
            <Text style={[styles.legendText, styles.legendPeakText]}>{t('home.peakDay')}</Text>
          </View>
        </View>

        <View style={[styles.statusRow, isRoomyHome && styles.statusRowRoomy, isCompactHome && styles.statusRowCompact, homeLayout.statusRow]}>
          <TouchableOpacity
            style={[styles.statusCard, isRoomyHome && styles.statusCardRoomy, isCompactHome && styles.statusCardCompact, homeLayout.statusCard, styles.statusCardTouchable, sectionCardPalette.ovulation]}
            activeOpacity={0.9}
            onPress={handleToggleOvulationInfo}
          >
            <View style={styles.statusTextBlock}>
              <Text style={[styles.statusLabel, { color: colors.secondary }]}>{t('home.ovulation')}</Text>
              <Text style={[styles.statusTitle, { color: ovulationStatus.accentColorType === 'peak' ? colors.ovulationPeak : colors.ovulation }]} numberOfLines={2}>{ovulationStatus.title}</Text>
              <Text style={[styles.statusSubtitle, { color: colors.secondary }]} numberOfLines={2}>{ovulationStatus.subtitle}</Text>
            </View>
            <StatusIndicator
              colors={colors}
              mode={ovulationStatus.indicatorMode}
              type="ovulation"
              accentColor={ovulationStatus.accentColorType === 'peak' ? colors.ovulationPeak : colors.ovulation}
              progressValue={ovulationStatus.progressValue}
              progressTotal={ovulationStatus.progressTotal}
            />
          </TouchableOpacity>

          <View style={[styles.statusCard, isRoomyHome && styles.statusCardRoomy, isCompactHome && styles.statusCardCompact, homeLayout.statusCard, sectionCardPalette.period]}>
            <View style={styles.statusTextBlock}>
              <Text style={[styles.statusLabel, { color: colors.secondary }]}>{t('home.periodUpper')}</Text>
              <Text style={[styles.statusTitle, { color: colors.period }]} numberOfLines={2}>{periodStatus.title}</Text>
              <Text style={[styles.statusSubtitle, { color: colors.secondary }]} numberOfLines={2}>{periodStatus.subtitle}</Text>
            </View>
            <StatusIndicator
              colors={colors}
              mode={periodStatus.indicatorMode}
              type="period"
              accentColor={colors.period}
              progressValue={periodStatus.progressValue}
              progressTotal={periodStatus.progressTotal}
            />
          </View>
        </View>

        <View style={[styles.infoCard, isRoomyHome && styles.infoCardRoomy, isCompactHome && styles.infoCardCompact, homeLayout.infoCard, sectionCardPalette.confidence]}>
          <Text style={[styles.infoLabel, { color: colors.secondary }]}>{t('home.confidence')}</Text>
          <Text style={[styles.infoValue, { color: colors.primary }]}>{t(`confidence.${cyclePrediction.confidenceKey || 'low'}`)}</Text>
          <Text
            style={[styles.infoText, isCompactHome && styles.infoTextCompact, { color: colors.secondary }]}
            numberOfLines={isCompactHome ? 2 : 3}
            ellipsizeMode="tail"
          >
            {getConfidenceDescription(cyclePrediction, t)}
          </Text>
        </View>
        </ScrollView>
      </Animated.View>

      <Modal visible={isHelpTourVisible} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.helpTourBackdrop} onPress={handleNextHelpStep}>
          {hasMeasuredCurrentHelpTarget ? (
            <>
              <Pressable
                style={[
                  styles.helpTourCard,
                  helpStepLayout.positionStyle,
                ]}
                onPress={() => {}}
              >
                {(() => {
                  const helpBubbleBg = theme === 'dark' ? 'rgba(32,33,36,0.9)' : 'rgba(255,255,255,0.9)';
                  const helpBubbleBorder = '#FFFFFF';
                  return (
                    <>
                {helpStepLayout.tailOnTop ? (
                  <View
                    style={[
                      styles.helpBubbleTailAnchor,
                      styles.helpBubbleTailTopAnchor,
                      {
                        left: helpStepLayout.tailTipX - 10,
                      },
                    ]}
                  >
                    <HelpBubbleTail side="top" backgroundColor={helpBubbleBg} borderColor={helpBubbleBorder} />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.helpBubbleBody,
                    {
                      backgroundColor: helpBubbleBg,
                      borderColor: helpBubbleBorder,
                    },
                  ]}
                  onLayout={(event) => {
                    const measuredHeight = event?.nativeEvent?.layout?.height;
                    if (measuredHeight && Math.abs(measuredHeight - helpBubbleHeight) > 1) {
                      setHelpBubbleHeight(measuredHeight);
                    }
                  }}
                >
                  <Text style={[styles.helpTourTitle, { color: colors.primary }]}>{currentHelpStep.title}</Text>
                  <Text style={[styles.helpTourMessage, { color: colors.secondary }]}>{currentHelpStep.message}</Text>
                </View>
                {!helpStepLayout.tailOnTop ? (
                  <View
                    style={[
                      styles.helpBubbleTailAnchor,
                      styles.helpBubbleTailBottomAnchor,
                      {
                        left: helpStepLayout.tailTipX - 10,
                      },
                    ]}
                  >
                    <HelpBubbleTail side="bottom" backgroundColor={helpBubbleBg} borderColor={helpBubbleBorder} />
                  </View>
                ) : null}
                    </>
                  );
                })()}
              </Pressable>
              <Pressable style={[styles.helpTourBottomActions, { paddingBottom: Math.max(insets.bottom, 14) }]} onPress={() => {}}>
                <TouchableOpacity
                  style={styles.helpTourActionButton}
                  onPress={closeHelpTour}
                >
                  <Text style={[styles.helpTourActionText, { color: colors.primary }]}>{t('common.close')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.helpTourActionButton}
                  onPress={handleNextHelpStep}
                >
                  <Text style={[styles.helpTourActionText, { color: colors.primary }]}>
                    {helpTourStepIndex === helpTourSteps.length - 1 ? t('common.finish') : t('common.next')}
                  </Text>
                </TouchableOpacity>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={isOvulationInfoVisible} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.ovulationInfoBackdrop} onPress={() => setOvulationInfoVisible(false)}>
          <Pressable
            style={[
              styles.ovulationInfoCard,
              {
                backgroundColor: sectionCardPalette.ovulation.backgroundColor,
                borderColor: sectionCardPalette.ovulation.borderColor,
                marginBottom: Math.max(insets.bottom, 12),
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.ovulationInfoHeader}>
              <Text style={[styles.ovulationInfoTitle, { color: colors.primary }]}>{t('home.ovulationGuide')}</Text>
              <TouchableOpacity
                style={[styles.ovulationInfoCloseButton, { borderColor: colors.outline, backgroundColor: colors.softCardStrong }]}
                onPress={() => setOvulationInfoVisible(false)}
                activeOpacity={0.85}
              >
                <MaterialIcons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.ovulationInfoSection}>
              <Text style={[styles.ovulationInfoLabel, { color: colors.ovulation }]}>{t('home.whatIsOvulation')}</Text>
              <Text style={[styles.ovulationInfoText, { color: colors.secondary }]}>
                {t('home.ovulationInfo')}
              </Text>
            </View>

            <View style={[styles.ovulationInfoSection, styles.ovulationInfoSectionLast]}>
              <Text style={[styles.ovulationInfoLabel, { color: '#D4A017' }]}>{t('home.peakInfoTitle')}</Text>
              <Text style={[styles.ovulationInfoText, { color: colors.secondary }]}>
                {t('home.peakInfo')}
              </Text>
            </View>

            <Text style={[styles.ovulationInfoHint, { color: colors.secondary }]}>
              {t('home.closeInfoHint')}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isNotificationPanelVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.notificationBackdrop}>
          <Pressable style={styles.notificationBackdropDismiss} onPress={() => setNotificationPanelVisible(false)} />
          <View
            style={[
              styles.notificationPanel,
              {
                backgroundColor: colors.softCard,
                borderColor: colors.outline,
                marginBottom: Math.max(insets.bottom, 12),
                paddingBottom: 20 + Math.max(insets.bottom, 4),
              },
            ]}
          >
            <View style={styles.notificationHeader}>
              <View style={styles.notificationHeaderText}>
                <Text style={[styles.notificationTitle, { color: colors.primary }]} numberOfLines={2}>{t('notifications.settings')}</Text>
                <Text style={[styles.notificationSubtitle, { color: colors.secondary }]}>{t('notifications.subtitle')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.notificationCloseButton, { borderColor: colors.outline, backgroundColor: colors.softCardStrong }]}
                onPress={() => setNotificationPanelVisible(false)}
              >
                <MaterialIcons name="close" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={notificationScrollRef}
              style={styles.notificationScroll}
              contentContainerStyle={styles.notificationScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {[
                { key: 'period', title: t('notifications.periodTitle'), description: t('notifications.periodDescription') },
                { key: 'ovulation', title: t('notifications.ovulationTitle'), description: t('notifications.ovulationDescription') },
                { key: 'peak', title: t('notifications.peakTitle'), description: t('notifications.peakDescription') },
              ].map((item) => (
                <View key={item.key} style={[styles.notificationOption, { borderColor: colors.outline }]}>
                  <View style={styles.notificationOptionText}>
                    <Text style={[styles.notificationOptionTitle, { color: colors.primary }]}>{item.title}</Text>
                    <Text style={[styles.notificationOptionDescription, { color: colors.secondary }]}>{item.description}</Text>
                  </View>
                  <Switch
                    value={notificationPreferences[item.key]}
                    onValueChange={() => handleToggleNotification(item.key)}
                    trackColor={{ false: colors.softCardStrong, true: colors.ovulation }}
                    thumbColor={notificationPreferences[item.key] ? colors.primary : colors.placeholder}
                  />
                </View>
              ))}

              <View style={[styles.notificationOption, { borderColor: colors.outline }]}>
                <View style={styles.notificationOptionText}>
                  <Text style={[styles.notificationOptionTitle, { color: colors.primary }]}>{t('notifications.averageCycleTitle')}</Text>
                  <Text style={[styles.notificationOptionDescription, { color: colors.secondary }]}>
                    {t('notifications.averageCycleDescription')}
                  </Text>
                </View>
                <View style={styles.cycleAdjustRow}>
                <TouchableOpacity
                  style={[styles.cycleAdjustButton, { borderColor: colors.outline, backgroundColor: colors.softCardStrong }]}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    handleCycleLengthChange(-1);
                  }}
                  activeOpacity={0.8}
                >
                    <MaterialIcons name="remove" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.cycleAdjustValue, { color: colors.primary }]}>{cycleSettings.averageCycleLength}</Text>
                <TouchableOpacity
                  style={[styles.cycleAdjustButton, { borderColor: colors.outline, backgroundColor: colors.softCardStrong }]}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    handleCycleLengthChange(1);
                  }}
                  activeOpacity={0.8}
                >
                    <MaterialIcons name="add" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.languageOption, { borderColor: colors.outline }]}>
                <TouchableOpacity
                  style={styles.languageSummaryRow}
                  onPress={handleToggleLanguagePicker}
                  activeOpacity={0.85}
                >
                  <View style={styles.notificationOptionText}>
                    <Text style={[styles.notificationOptionTitle, { color: colors.primary }]}>{t('notifications.languageTitle')}</Text>
                    <Text style={[styles.notificationOptionDescription, { color: colors.secondary }]}>
                      {supportedLanguages.find((item) => item.code === language)?.label || language}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isLanguagePickerExpanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {isLanguagePickerExpanded ? (
                  <>
                    <Text style={[styles.notificationOptionDescription, { color: colors.secondary }]}>
                      {t('notifications.languageDescription')}
                    </Text>
                    <View style={styles.languageGrid}>
                      {supportedLanguages.map((item) => (
                        <TouchableOpacity
                          key={item.code}
                          style={[
                            styles.languageButton,
                            {
                              borderColor: language === item.code ? colors.primary : colors.outline,
                              backgroundColor: language === item.code ? colors.primary : colors.softCardStrong,
                            },
                          ]}
                          onPress={() => {
                            setLanguage(item.code);
                            setLanguagePickerExpanded(false);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.languageButtonText, { color: language === item.code ? colors.background : colors.primary }]} numberOfLines={1}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>

              {notificationMessage ? (
                <Text style={[styles.notificationMessage, { color: colors.secondary }]}>{notificationMessage}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ThemedDialog
        visible={isMultiplePeriodDialogVisible}
        title={t('home.secondPeriodTitle')}
        message={t('home.secondPeriodMessage')}
        actions={[
          {
            label: t('common.cancel'),
            onPress: () => {
              setPendingCalendarPayload(null);
              setMultiplePeriodDialogVisible(false);
            },
          },
          { label: t('common.confirm'), variant: 'primary', onPress: handleConfirmMultiplePeriodLog },
        ]}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenContent: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 16 },
  scrollContentRoomy: { paddingTop: 12 },
  scrollContentCompact: { paddingHorizontal: 10, paddingTop: 5, paddingBottom: 10 },
  quoteCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
    height: 184,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  quoteCardCompact: {
    height: 168,
    marginBottom: 11,
  },
  quoteCardRoomy: {
    height: 226,
    marginBottom: 14,
  },
  cardBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  quoteContent: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  quoteImageBackground: {
    flex: 1,
    height: '100%',
  },
  quoteImageStyle: {
    borderRadius: 24,
  },
  quoteImageVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  quoteTextShell: {
    borderWidth: 1,
    borderRadius: 20,
    width: '100%',
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quoteTextShellCompact: {
    minHeight: 72,
    paddingVertical: 8,
  },
  quoteTextShellRoomy: {
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quoteText: {
    fontFamily: 'TitilliumWeb_300Light_Italic',
    fontSize: 16,
    lineHeight: 22,
    opacity: 1,
    textShadowColor: 'rgba(255,255,255,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  quoteTextCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  quoteTextRoomy: {
    fontSize: 17,
    lineHeight: 23,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 9,
    paddingHorizontal: 4,
  },
  sectionHeaderCompact: {
    marginBottom: 7,
  },
  sectionHeaderRoomy: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 11,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  weekCardCompact: {
    padding: 8,
  },
  weekCardRoomy: {
    padding: 14,
  },
  weekCardGlow: {
    position: 'absolute',
    top: -22,
    right: -12,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  weekCardGlowSecondary: {
    position: 'absolute',
    bottom: -34,
    left: -14,
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  weekHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  weekHintCapsuleButton: {
    flex: 1,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  weekHintIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  weekHintArrowLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 2 }],
  },
  weekHint: {
    fontSize: 11,
    fontWeight: '800',
  },
  dropButtonVisual: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarEditTouchArea: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarEditDropIcon: {
    position: 'absolute',
    top: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    gap: 8,
  },
  weekColumn: {
    flex: 1,
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: '900',
  },
  weekDayBubble: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  weekDayNumberGlow: {
    textShadowColor: 'rgba(0, 0, 0, 0.62)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
  todayNumber: {
    fontSize: 17,
    fontWeight: '900',
  },
  todayNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'transparent',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTodayNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.4,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 6,
    marginTop: 11,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  legendCompact: {
    marginTop: 9,
    marginBottom: 10,
    gap: 8,
  },
  legendRoomy: {
    marginTop: 15,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  legendPeakText: {
    color: '#D4A017',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statusRowCompact: {
    marginBottom: 8,
  },
  statusRowRoomy: {
    marginBottom: 18,
  },
  statusCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    paddingTop: 12,
    paddingRight: 34,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statusCardCompact: {
    minHeight: 86,
    paddingTop: 8,
    paddingBottom: 8,
  },
  statusCardRoomy: {
    minHeight: 104,
    paddingTop: 16,
    paddingBottom: 14,
  },
  statusCardTouchable: {
    alignItems: 'stretch',
  },
  statusTextBlock: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 5,
  },
  statusLabel: {
    alignSelf: 'flex-start',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  indicatorShell: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    textAlign: 'left',
    flexShrink: 1,
  },
  statusSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 14,
    flexShrink: 1,
  },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 5,
    minHeight: 100,
    justifyContent: 'center',
  },
  infoCardCompact: {
    padding: 12,
    gap: 4,
    minHeight: 92,
  },
  infoCardRoomy: {
    padding: 20,
    gap: 8,
    minHeight: 128,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  infoText: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  infoTextCompact: {
    fontSize: 10.8,
    lineHeight: 15.5,
  },
  ovulationInfoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14,16,24,0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  ovulationInfoCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  ovulationInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ovulationInfoTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  ovulationInfoCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovulationInfoSection: {
    gap: 6,
  },
  ovulationInfoSectionLast: {
    paddingTop: 4,
  },
  ovulationInfoLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  ovulationInfoText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  ovulationInfoHint: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    opacity: 0.8,
    paddingTop: 2,
  },
  expandedCalendarPanel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 10,
    marginTop: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  expandedCalendarPanelAnimated: {
    overflow: 'hidden',
  },
  calendarOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 34,
  },
  calendarOverlayBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,10,16,0.42)',
  },
  calendarOverlayPanelAnimated: {
    maxHeight: '92%',
  },
  calendarOverlayPressable: {
    maxHeight: '100%',
  },
  calendarOverlayScroll: {
    maxHeight: '100%',
  },
  calendarOverlayScrollContent: {
    paddingBottom: 8,
  },
  expandedCalendarHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarIconButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  calendarRow: {
    flexDirection: 'row',
    width: '100%',
  },
  calendarColumn: {
    flex: 1,
    minHeight: 36,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCalendarColumn: {
    opacity: 0,
  },
  modalWeekDayName: {
    fontSize: 9,
    fontWeight: '900',
  },
  modalDayBubble: {
    width: 31,
    height: 31,
    borderRadius: 13,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  modalDayText: {
    fontSize: 12,
    fontWeight: '900',
  },
  modalDayNumberLayer: {
    zIndex: 2,
  },
  modalStartDayBadge: {
    position: 'absolute',
    top: -9,
    minWidth: 54,
    height: 16,
    paddingHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  modalStartDayBadgeText: {
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 9,
  },
  editorCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  editorTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  editorText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  durationSelector: {
    flexDirection: 'row',
    gap: 7,
  },
  durationButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    fontSize: 12,
    fontWeight: '900',
  },
  saveCalendarButton: {
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCalendarText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  deleteCalendarButton: {
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deleteCalendarText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  clearCalendarButton: {
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  clearCalendarText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  quickStartTouchArea: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 1 }],
  },
  quickStartDropIcon: {
    position: 'absolute',
    top: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartText: {
    fontSize: 11,
    fontWeight: '800',
  },
  helpTourBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  helpTourCard: {
    position: 'absolute',
    width: HELP_TOUR_CARD_WIDTH,
    borderRadius: 20,
    borderWidth: 0,
    padding: 0,
    overflow: 'visible',
  },
  helpBubbleBody: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 7,
  },
  helpBubbleTailAnchor: {
    position: 'absolute',
    width: 20,
    height: 14,
  },
  helpBubbleTailSvgTop: {
    width: 20,
    height: 14,
  },
  helpBubbleTailSvgBottom: {
    width: 20,
    height: 14,
  },
  helpBubbleTailTopAnchor: {
    top: -13,
  },
  helpBubbleTailBottomAnchor: {
    bottom: -13,
  },
  helpTourTitle: {
    fontSize: 17,
    fontFamily: 'TitilliumWeb_700Bold',
    fontWeight: '900',
  },
  helpTourMessage: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'TitilliumWeb_700Bold',
    fontWeight: '700',
  },
  helpTourBottomActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  helpTourActionButton: {
    minWidth: 62,
    height: 32,
    borderRadius: 0,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  helpTourActionText: {
    fontSize: 13,
    fontFamily: 'TitilliumWeb_700Bold',
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  notificationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  notificationBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationPanel: {
    width: '100%',
    maxWidth: 420,
    height: '78%',
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    maxHeight: '86%',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 48,
    paddingRight: 52,
  },
  notificationHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: 20,
    fontWeight: '900',
    flexShrink: 1,
  },
  notificationSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  notificationCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationOption: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  notificationOptionText: {
    flex: 1,
    gap: 4,
  },
  notificationOptionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  notificationOptionDescription: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  notificationScroll: {
    flex: 1,
    minHeight: 0,
  },
  notificationScrollContent: {
    gap: 12,
    paddingBottom: 12,
  },
  languageOption: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  languageSummaryRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  languageButton: {
    width: '31.5%',
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButtonText: {
    fontSize: 9,
    fontWeight: '800',
  },
  notificationMessage: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  cycleAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cycleAdjustButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleAdjustValue: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
  },
});
