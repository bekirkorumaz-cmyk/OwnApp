import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { createLocalPeriodLog } from '../services/localPeriodLogs';
import { createPeriodLog } from '../services/periodLogs';
import { ThemedDialog } from '../components/ThemedDialog';
import { DEFAULT_CYCLE_SETTINGS, getClampedCycleLength, saveCycleSettings } from '../services/cycleSettings';

export const OnboardingScreen = ({ initialCycleSettings = DEFAULT_CYCLE_SETTINGS, onComplete, onBack }) => {
  const { theme, colors } = useTheme();
  const { t } = useLanguage();
  const { isLocalMode, user } = useAuth();
  const monthNames = t('calendar.months');
  const monthShortNames = t('calendar.monthsShort');
  const weekDayNames = t('calendar.weekdays');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isCompactOnboarding = windowHeight < 700;
  const isRoomyOnboarding = windowHeight >= 780;
  const now = new Date();
  const [displayedMonthDate, setDisplayedMonthDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const currentMonth = displayedMonthDate.getMonth();
  const currentYear = displayedMonthDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startSpace = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const isCurrentOrFutureMonth = currentYear > now.getFullYear()
    || (currentYear === now.getFullYear() && currentMonth >= now.getMonth());
  const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();

  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [duration, setDuration] = useState(initialCycleSettings.periodLength || DEFAULT_CYCLE_SETTINGS.periodLength);
  const [averageCycleLength, setAverageCycleLength] = useState(initialCycleSettings.averageCycleLength || DEFAULT_CYCLE_SETTINGS.averageCycleLength);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const startIndicatorColor = theme === 'dark' ? '#FFFFFF' : '#111111';

  useEffect(() => {
    setAverageCycleLength(initialCycleSettings.averageCycleLength || DEFAULT_CYCLE_SETTINGS.averageCycleLength);
    setDuration(initialCycleSettings.periodLength || DEFAULT_CYCLE_SETTINGS.periodLength);
  }, [initialCycleSettings.averageCycleLength, initialCycleSettings.periodLength]);

  const weeks = useMemo(() => {
    const gridItems = [
      ...Array(startSpace).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
    const filled = [
      ...gridItems,
      ...Array((7 - (gridItems.length % 7)) % 7).fill(null),
    ];
    const rows = [];
    for (let i = 0; i < filled.length; i += 7) {
      rows.push(filled.slice(i, i + 7));
    }
    return rows;
  }, [daysInMonth, startSpace]);

  const selectedDays = useMemo(() => (
    Array.from({ length: duration }, (_, index) => selectedDay + index)
      .filter((day) => day <= daysInMonth)
  ), [daysInMonth, duration, selectedDay]);

  const handleMonthChange = (offset) => {
    setDisplayedMonthDate((currentDate) => {
      const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
      const nextDaysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      const isNextCurrentMonth = nextDate.getFullYear() === now.getFullYear() && nextDate.getMonth() === now.getMonth();
      const maxSelectableDay = isNextCurrentMonth ? Math.min(now.getDate(), nextDaysInMonth) : nextDaysInMonth;
      setSelectedDay((day) => Math.min(day, maxSelectableDay));
      return nextDate;
    });
  };

  const handleDurationChange = (nextDuration) => {
    setDuration(nextDuration);
  };

  const handleSave = async () => {
    if (!isLocalMode && !user?.id) {
      setDialogMessage(t('onboarding.relogin'));
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        year: currentYear,
        monthIndex: currentMonth,
        startDay: selectedDay,
        duration,
        selectedDays,
        hasStarted: true,
        flowStatus: 'orta',
        painLevel: 'yok',
      };

      if (isLocalMode) {
        await createLocalPeriodLog(payload);
      } else {
        await createPeriodLog({ userId: user.id, ...payload });
      }

      await saveCycleSettings({ averageCycleLength, periodLength: duration });

      onComplete?.();
    } catch (error) {
      console.error('İlk regl kaydı oluşturulamadı:', error);
      setDialogMessage(error.message || t('onboarding.createFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isCompactOnboarding && styles.contentCompact,
          isRoomyOnboarding && styles.contentRoomy,
          { paddingBottom: Math.max(insets.bottom + 6, isCompactOnboarding ? 10 : 16) },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={isCompactOnboarding}
        bounces={false}
      >
        <TouchableOpacity
          style={[styles.iconBackButton, isCompactOnboarding && styles.iconBackButtonCompact]}
          onPress={onBack}
          activeOpacity={0.72}
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <View style={[styles.centeredContent, isCompactOnboarding && styles.centeredContentCompact, isRoomyOnboarding && styles.centeredContentRoomy]}>
          <View style={[styles.header, isCompactOnboarding && styles.headerCompact, isRoomyOnboarding && styles.headerRoomy]}>
            <Text style={[styles.title, isCompactOnboarding && styles.titleCompact, isRoomyOnboarding && styles.titleRoomy, { color: colors.primary }]}>{t('onboarding.title')}</Text>
            <Text style={[styles.subtitle, isCompactOnboarding && styles.subtitleCompact, { color: colors.secondary }]}>
              {t('onboarding.subtitle')}
            </Text>
          </View>

        <View style={[styles.card, isCompactOnboarding && styles.cardCompact, isRoomyOnboarding && styles.cardRoomy, { backgroundColor: colors.surfaceVariant + '40', borderColor: colors.outline + '40' }]}>
          <View style={styles.monthSelector}>
            <TouchableOpacity style={[styles.monthButton, { borderColor: colors.outline }]} onPress={() => handleMonthChange(-1)}>
              <MaterialIcons name="chevron-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.month, { color: colors.primary }]}>{monthNames[currentMonth]} {currentYear}</Text>
            <TouchableOpacity
              style={[
                styles.monthButton,
                { borderColor: colors.outline, opacity: isCurrentOrFutureMonth ? 0.35 : 1 },
              ]}
              onPress={() => handleMonthChange(1)}
              disabled={isCurrentOrFutureMonth}
            >
              <MaterialIcons name="chevron-right" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            {weekDayNames.map((day) => (
              <View key={day} style={styles.column}>
                <Text style={[styles.weekDay, { color: colors.secondary }]}>{day}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.row}>
              {week.map((day, dayIndex) => {
                const isSelected = selectedDays.includes(day);
                const isStart = day === selectedDay;
                const isFutureDay = isCurrentMonth && day > now.getDate();
                return (
                  <TouchableOpacity
                    key={`${weekIndex}-${dayIndex}`}
                  style={[styles.column, isCompactOnboarding && styles.columnCompact, isRoomyOnboarding && styles.columnRoomy, isFutureDay && styles.disabledDay]}
                    disabled={!day || isFutureDay}
                    onPress={() => day && setSelectedDay(day)}
                  >
                    <View
                      style={[
                        styles.dayBubble,
                        isCompactOnboarding && styles.dayBubbleCompact,
                        isRoomyOnboarding && styles.dayBubbleRoomy,
                        {
                          backgroundColor: isSelected ? colors.period : 'transparent',
                          borderColor: isSelected
                            ? (theme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.28)')
                            : colors.outline,
                        },
                        isFutureDay && { opacity: 0.35 },
                        isSelected && { borderWidth: 2.5, borderColor: startIndicatorColor },
                        isStart && { borderWidth: 3.5, borderColor: startIndicatorColor },
                      ]}
                    >
                      {day && isStart ? (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.startDayBadge,
                            { backgroundColor: startIndicatorColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.startDayBadgeText,
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
                        <Text
                          style={[
                            styles.dayText,
                            isCompactOnboarding && styles.dayTextCompact,
                            isRoomyOnboarding && styles.dayTextRoomy,
                            {
                              color: isStart
                                ? '#FFFFFF'
                                : isSelected
                                  ? (theme === 'dark' ? '#FFFFFF' : '#111111')
                                  : colors.text,
                            },
                            isSelected && styles.selectedDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={[styles.selectionSummary, isCompactOnboarding && styles.selectionSummaryCompact, isRoomyOnboarding && styles.selectionSummaryRoomy, { backgroundColor: colors.surfaceVariant, borderColor: colors.outline + '35' }]}>
            <Text style={[styles.selectionSummaryText, { color: colors.text }]}>
              {t('onboarding.start', { day: selectedDay, month: monthShortNames[currentMonth] })}
            </Text>
            <Text style={[styles.selectionSummaryText, { color: colors.secondary }]}>
              {t('onboarding.duration', { count: duration })}
            </Text>
          </View>

          <View style={[styles.durationRow, isCompactOnboarding && styles.durationRowCompact, isRoomyOnboarding && styles.durationRowRoomy, { borderTopColor: colors.outline + '30' }]}>
            <Text style={[styles.durationTitle, { color: colors.secondary }]}>{t('onboarding.durationTitle')}</Text>
            <View style={styles.durationSelector}>
              {[2, 3, 4, 5, 6, 7, 8].map((dayCount) => (
                <TouchableOpacity
                  key={dayCount}
                  onPress={() => handleDurationChange(dayCount)}
                  style={[
                    styles.durationButton,
                    { borderColor: colors.outline },
                    duration === dayCount && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.durationText, { color: duration === dayCount ? colors.background : colors.primary }]}>
                    {dayCount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.durationRow, isCompactOnboarding && styles.durationRowCompact, isRoomyOnboarding && styles.durationRowRoomy, { borderTopColor: colors.outline + '30' }]}>
            <Text style={[styles.durationTitle, { color: colors.secondary }]}>{t('onboarding.averageCycleTitle')}</Text>
            <View style={styles.cycleLengthRow}>
              <TouchableOpacity
                style={[styles.adjustButton, { borderColor: colors.outline }]}
                onPress={() => setAverageCycleLength((value) => getClampedCycleLength(value - 1))}
              >
                <MaterialIcons name="remove" size={20} color={colors.primary} />
              </TouchableOpacity>
              <View style={[styles.cycleLengthBadge, { borderColor: colors.outline, backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.cycleLengthValue, { color: colors.primary }]}>{averageCycleLength} {t('common.days')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.adjustButton, { borderColor: colors.outline }]}
                onPress={() => setAverageCycleLength((value) => getClampedCycleLength(value + 1))}
              >
                <MaterialIcons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isCompactOnboarding && styles.saveButtonCompact, isRoomyOnboarding && styles.saveButtonRoomy, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={[styles.saveButtonText, { color: colors.background }]}>
            {isSaving ? t('common.saving') : t('onboarding.startButton')}
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>

      <ThemedDialog
        visible={Boolean(dialogMessage)}
        title={t('onboarding.createFailed')}
        message={dialogMessage || ''}
        actions={[
          {
            label: t('common.ok'),
            variant: 'primary',
            onPress: () => setDialogMessage(null),
          },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  contentCompact: { paddingHorizontal: 16, paddingTop: 4 },
  contentRoomy: { paddingTop: 12 },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  centeredContentCompact: {
    justifyContent: 'flex-start',
    paddingBottom: 4,
  },
  centeredContentRoomy: {
    justifyContent: 'center',
    paddingBottom: 12,
  },
  iconBackButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconBackButtonCompact: {
    width: 26,
    height: 24,
    marginBottom: 0,
  },
  header: { gap: 6, marginTop: 0, marginBottom: 10 },
  headerCompact: { gap: 3, marginBottom: 6 },
  headerRoomy: { gap: 8, marginBottom: 14 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.7 },
  titleCompact: { fontSize: 22 },
  titleRoomy: { fontSize: 27 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  subtitleCompact: { fontSize: 12, lineHeight: 17 },
  card: { borderRadius: 24, borderWidth: 1, padding: 12 },
  cardCompact: { borderRadius: 22, padding: 9 },
  cardRoomy: { padding: 14 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthButton: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  month: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'nowrap', width: '100%' },
  column: { flex: 1, minHeight: 35, paddingHorizontal: 2, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  columnCompact: { minHeight: 30, paddingVertical: 2 },
  columnRoomy: { minHeight: 38, paddingVertical: 4 },
  disabledDay: { opacity: 0.55 },
  weekDay: { fontSize: 9, fontWeight: '900', opacity: 0.7, marginBottom: 2 },
  dayBubble: {
    width: 29,
    height: 29,
    borderRadius: 11,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  dayBubbleCompact: {
    width: 27,
    height: 27,
    borderRadius: 10,
  },
  dayBubbleRoomy: {
    width: 31,
    height: 31,
    borderRadius: 12,
  },
  startDayBadge: {
    position: 'absolute',
    top: -9,
    minWidth: 52,
    height: 14,
    paddingHorizontal: 5,
    borderRadius: 7,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  startDayBadgeText: { fontSize: 5.8, fontWeight: '900', letterSpacing: 0, lineHeight: 6.5, includeFontPadding: false },
  dayText: { fontSize: 11, fontWeight: '900' },
  dayTextCompact: { fontSize: 10 },
  dayTextRoomy: { fontSize: 12 },
  selectedDayText: {
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectionSummary: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionSummaryCompact: { marginTop: 6, paddingVertical: 6 },
  selectionSummaryRoomy: { marginTop: 10, paddingVertical: 9 },
  selectionSummaryText: { fontSize: 12, fontWeight: '700' },
  durationRow: { borderTopWidth: 1, marginTop: 8, paddingTop: 8, gap: 7 },
  durationRowCompact: { marginTop: 6, paddingTop: 6, gap: 5 },
  durationRowRoomy: { marginTop: 10, paddingTop: 10, gap: 8 },
  durationTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  durationSelector: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  durationButton: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  durationText: { fontSize: 13, fontWeight: '800' },
  cycleLengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  adjustButton: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cycleLengthBadge: { flex: 1, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cycleLengthValue: { fontSize: 15, fontWeight: '800' },
  saveButton: { height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveButtonCompact: { height: 40, marginTop: 8 },
  saveButtonRoomy: { height: 50, marginTop: 14 },
  saveButtonText: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
});
