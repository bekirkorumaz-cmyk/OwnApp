import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

const NOTIFICATION_PREFS_KEY = 'the_rhythm_notification_preferences';
const NOTIFICATION_IDS_KEY = 'the_rhythm_scheduled_notification_ids';
const NOTIFICATION_CHANNEL_ID = 'cycle-reminders';

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  period: false,
  ovulation: false,
  peak: false,
};

export const isNotificationFeatureAvailable = Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

const parseDate = (dateText) => new Date(`${dateText}T09:00:00`);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getFutureTriggerDate = (dateText) => {
  if (!dateText) return null;

  const date = parseDate(dateText);
  return date > new Date() ? date : null;
};

export const getNotificationPreferences = async () => {
  const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
  if (!stored) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...JSON.parse(stored),
  };
};

export const saveNotificationPreferences = async (preferences) => {
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(preferences));
};

export const ensureNotificationPermission = async (texts = {}) => {
  if (!isNotificationFeatureAvailable) return false;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: texts.channelName || 'Cycle Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return true;
};

const cancelStoredNotifications = async () => {
  const stored = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
  const ids = stored ? JSON.parse(stored) : [];

  if (!isNotificationFeatureAvailable) {
    await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
    return;
  }

  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
};

const scheduleNotification = async ({ identifier, title, body, date }) => (
  Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  })
);

export const rescheduleCycleNotifications = async ({ preferences, prediction, texts = {} }) => {
  await cancelStoredNotifications();
  if (!isNotificationFeatureAvailable) return;

  const scheduledIds = [];

  if (preferences.period) {
    const date = getFutureTriggerDate(prediction.nextPeriodDateText);
    if (date) {
      scheduledIds.push(await scheduleNotification({
        identifier: 'the-rhythm-period-reminder',
        title: texts.periodTitle || 'Period reminder',
        body: texts.periodBody || 'Today is your estimated period start day. Be gentle with yourself.',
        date,
      }));
    }
  }

  if (preferences.ovulation && prediction.ovulationDateText) {
    const date = getFutureTriggerDate(toDateText(addDays(parseDate(prediction.ovulationDateText), -5)));
    if (date) {
      scheduledIds.push(await scheduleNotification({
        identifier: 'the-rhythm-ovulation-reminder',
        title: texts.ovulationTitle || 'Fertile window started',
        body: texts.ovulationBody || 'Your estimated fertile window has started.',
        date,
      }));
    }
  }

  if (preferences.peak) {
    const date = getFutureTriggerDate(prediction.ovulationDateText);
    if (date) {
      scheduledIds.push(await scheduleNotification({
        identifier: 'the-rhythm-peak-reminder',
        title: texts.peakTitle || 'Peak fertile day',
        body: texts.peakBody || 'Today is your estimated peak ovulation day.',
        date,
      }));
    }
  }

  await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(scheduledIds));
};

const toDateText = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
