import AsyncStorage from '@react-native-async-storage/async-storage';

const CYCLE_SETTINGS_KEY = 'the_rhythm_cycle_settings';
const DEFAULT_AVERAGE_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

const clampCycleLength = (value) => Math.min(45, Math.max(21, value || DEFAULT_AVERAGE_CYCLE_LENGTH));
const clampPeriodLength = (value) => Math.min(8, Math.max(2, Number(value) || DEFAULT_PERIOD_LENGTH));

export const DEFAULT_CYCLE_SETTINGS = {
  averageCycleLength: DEFAULT_AVERAGE_CYCLE_LENGTH,
  periodLength: DEFAULT_PERIOD_LENGTH,
};

export const getCycleSettings = async () => {
  const stored = await AsyncStorage.getItem(CYCLE_SETTINGS_KEY);
  if (!stored) return DEFAULT_CYCLE_SETTINGS;

  try {
    const parsed = JSON.parse(stored);
    return {
      averageCycleLength: clampCycleLength(parsed.averageCycleLength),
      periodLength: clampPeriodLength(parsed.periodLength),
    };
  } catch {
    return DEFAULT_CYCLE_SETTINGS;
  }
};

export const saveCycleSettings = async (settings) => {
  const current = await getCycleSettings();
  const next = {
    averageCycleLength: clampCycleLength(settings.averageCycleLength ?? current.averageCycleLength),
    periodLength: clampPeriodLength(settings.periodLength ?? current.periodLength),
  };

  await AsyncStorage.setItem(CYCLE_SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const getClampedCycleLength = clampCycleLength;
