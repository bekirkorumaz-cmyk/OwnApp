const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;

const parseDate = (dateText) => new Date(`${dateText}T00:00:00`);

const toDateText = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const diffDays = (startDate, endDate) => Math.round((endDate - startDate) / DAY_MS);

const isSameMonth = (date, year, monthIndex) => (
  date.getFullYear() === year && date.getMonth() === monthIndex
);

const clampCycleLength = (length) => Math.min(45, Math.max(21, length));
const clampPeriodLength = (length) => Math.min(8, Math.max(2, length));

const getAverage = (values, fallback) => {
  if (!values.length) return fallback;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
};

const getMedian = (values, fallback) => {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
};

const getRecentWeightedAverage = (values, fallback, limit = 6) => {
  if (!values.length) return fallback;
  const recentValues = values.slice(-limit);
  const totalWeight = recentValues.reduce((sum, _value, index) => sum + index + 1, 0);
  const weightedTotal = recentValues.reduce((sum, value, index) => sum + (value * (index + 1)), 0);
  return Math.round(weightedTotal / totalWeight);
};

const getRobustAverageCycleLength = (cycleLengths, fallback) => {
  if (!cycleLengths.length) return fallback;

  const recentCycleLengths = cycleLengths.slice(-6);
  const median = getMedian(recentCycleLengths, fallback);
  const filtered = recentCycleLengths.filter((length) => Math.abs(length - median) <= 4);
  const baseline = filtered.length ? filtered : recentCycleLengths;

  return clampCycleLength(getRecentWeightedAverage(baseline, median));
};

const getRobustAveragePeriodLength = (periodLengths, fallback) => {
  if (!periodLengths.length) return fallback;

  const recentPeriodLengths = periodLengths.slice(-6);
  const median = getMedian(recentPeriodLengths, fallback);
  const filtered = recentPeriodLengths.filter((length) => Math.abs(length - median) <= 2);
  const baseline = filtered.length ? filtered : recentPeriodLengths;

  return clampPeriodLength(getRecentWeightedAverage(baseline, median));
};

const getRange = (values) => {
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
};

const getRegularityStatus = (cycleLengths) => {
  if (cycleLengths.length < 2) {
    return 'low_data';
  }

  const recentCycleLengths = cycleLengths.slice(-6);
  const range = getRange(recentCycleLengths);

  if (recentCycleLengths.length >= 3 && range <= 4) {
    return 'regular';
  }

  if (range <= 8) {
    return 'variable';
  }

  return 'irregular';
};

const getPredictionWindowDays = (regularityStatus, cycleLengthsLength, isUsingCustomCycleLength) => {
  if (cycleLengthsLength === 0 && isUsingCustomCycleLength) return 2;
  if (cycleLengthsLength < 2) return 3;
  if (regularityStatus === 'regular') return 1;
  if (regularityStatus === 'variable') return 3;
  return 5;
};

const getConfidenceKey = ({ cycleLengthsLength, regularityStatus, isUsingCustomCycleLength }) => {
  if (cycleLengthsLength >= 4 && regularityStatus === 'regular') return 'veryHigh';
  if (cycleLengthsLength >= 3 && regularityStatus === 'regular') return 'high';
  if (cycleLengthsLength >= 3 && regularityStatus === 'variable') return 'good';
  if (cycleLengthsLength >= 2) return 'medium';
  if (cycleLengthsLength === 1) return 'developing';
  if (isUsingCustomCycleLength) return 'personalStart';
  return 'low';
};

export const getCyclePrediction = ({
  logs,
  year,
  monthIndex,
  today = new Date(),
  fallbackCycleLength = DEFAULT_CYCLE_LENGTH,
}) => {
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sortedLogs = logs
    .filter((log) => log.start_date)
    .sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));

  const actualPeriodDays = new Set();
  const actualPeriodDates = new Set();

  sortedLogs.forEach((log) => {
    log.selected_dates?.forEach((dateText) => {
      const date = parseDate(dateText);
      actualPeriodDates.add(dateText);
      if (isSameMonth(date, year, monthIndex)) {
        actualPeriodDays.add(date.getDate());
      }
    });
  });

  if (!sortedLogs.length) {
    return {
      actualPeriodDays,
      actualPeriodDates,
      predictedPeriodDays: new Set(),
      predictedPeriodDates: new Set(),
      fertileDays: new Set(),
      fertileDates: new Set(),
      ovulationPeakDates: new Set(),
      ovulationDay: null,
      ovulationDateText: null,
      nextPeriodDateText: null,
      daysUntilNextPeriod: null,
      nextPhase: 'Kayıt bekleniyor',
      confidence: 'Kayıt yok',
      confidenceKey: 'noData',
      regularityStatus: 'low_data',
      predictionWindowStartText: null,
      predictionWindowEndText: null,
      averageCycleLength: DEFAULT_CYCLE_LENGTH,
      averagePeriodLength: DEFAULT_PERIOD_LENGTH,
      isUsingCustomCycleLength: false,
    };
  }

  const startDates = sortedLogs.map((log) => parseDate(log.start_date));
  const cycleLengths = [];
  for (let i = 1; i < startDates.length; i += 1) {
    const length = diffDays(startDates[i - 1], startDates[i]);
    if (length >= 21 && length <= 45) {
      cycleLengths.push(length);
    }
  }

  const effectiveFallbackCycleLength = clampCycleLength(fallbackCycleLength);
  const isUsingCustomCycleLength = cycleLengths.length === 0 && effectiveFallbackCycleLength !== DEFAULT_CYCLE_LENGTH;
  const averageCycleLength = getRobustAverageCycleLength(cycleLengths, effectiveFallbackCycleLength);
  const averagePeriodLength = getRobustAveragePeriodLength(
    sortedLogs.map((log) => log.duration).filter(Boolean),
    DEFAULT_PERIOD_LENGTH
  );
  const regularityStatus = getRegularityStatus(cycleLengths);

  let nextPeriodDate = addDays(startDates[startDates.length - 1], averageCycleLength);
  while (nextPeriodDate < normalizedToday) {
    nextPeriodDate = addDays(nextPeriodDate, averageCycleLength);
  }

  const ovulationDate = addDays(nextPeriodDate, -14);
  const predictedPeriodDays = new Set();
  const predictedPeriodDates = new Set();
  const fertileDays = new Set();
  const fertileDates = new Set();
  const ovulationPeakDates = new Set();

  for (let cycleIndex = 0; cycleIndex <= 12; cycleIndex += 1) {
    const cyclePeriodDate = addDays(nextPeriodDate, averageCycleLength * cycleIndex);
    const cycleOvulationDate = addDays(cyclePeriodDate, -14);
    ovulationPeakDates.add(toDateText(cycleOvulationDate));

    for (let i = 0; i < averagePeriodLength; i += 1) {
      const date = addDays(cyclePeriodDate, i);
      predictedPeriodDates.add(toDateText(date));
      if (isSameMonth(date, year, monthIndex)) {
        predictedPeriodDays.add(date.getDate());
      }
    }

    for (let offset = -5; offset <= 1; offset += 1) {
      const date = addDays(cycleOvulationDate, offset);
      fertileDates.add(toDateText(date));
      if (isSameMonth(date, year, monthIndex)) {
        fertileDays.add(date.getDate());
      }
    }
  }

  const daysUntilNextPeriod = Math.max(0, diffDays(normalizedToday, nextPeriodDate));
  const predictionWindowDays = getPredictionWindowDays(regularityStatus, cycleLengths.length, isUsingCustomCycleLength);
  const predictionWindowStartDate = addDays(nextPeriodDate, -predictionWindowDays);
  const predictionWindowEndDate = addDays(nextPeriodDate, predictionWindowDays);
  const nextPhase = daysUntilNextPeriod <= 5
    ? 'Regl yaklaşımı'
    : normalizedToday < ovulationDate
      ? 'Foliküler'
      : 'Luteal';

  return {
    actualPeriodDays,
    actualPeriodDates,
    predictedPeriodDays,
    predictedPeriodDates,
    fertileDays,
    fertileDates,
    ovulationPeakDates,
    ovulationDay: isSameMonth(ovulationDate, year, monthIndex) ? ovulationDate.getDate() : null,
    ovulationDateText: toDateText(ovulationDate),
    nextPeriodDateText: toDateText(nextPeriodDate),
    predictionWindowStartText: toDateText(predictionWindowStartDate),
    predictionWindowEndText: toDateText(predictionWindowEndDate),
    daysUntilNextPeriod,
    nextPhase,
    confidenceKey: getConfidenceKey({
      cycleLengthsLength: cycleLengths.length,
      regularityStatus,
      isUsingCustomCycleLength,
    }),
    regularityStatus,
    averageCycleLength,
    averagePeriodLength,
    isUsingCustomCycleLength,
  };
};
