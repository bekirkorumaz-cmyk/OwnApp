import { requireSupabase } from './supabaseClient';

const toDateString = (year, monthIndex, day) => {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

const getConsecutiveDatesFromStart = ({ year, monthIndex, startDay, duration }) => {
  const startDate = new Date(year, monthIndex, startDay);
  return Array.from({ length: duration }, (_, index) => {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + index);
    return toDateString(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  });
};

const getMonthRange = (year, monthIndex) => {
  const nextMonth = new Date(year, monthIndex + 1, 1);

  return {
    start: toDateString(year, monthIndex, 1),
    end: toDateString(nextMonth.getFullYear(), nextMonth.getMonth(), 1),
  };
};

export const createPeriodLog = async ({
  userId,
  year,
  monthIndex,
  startDay,
  duration,
  hasStarted,
  flowStatus,
  painLevel,
}) => {
  const client = requireSupabase();
  const startDate = toDateString(year, monthIndex, startDay);

  const { error: deleteError } = await client
    .from('period_logs')
    .delete()
    .eq('user_id', userId)
    .eq('start_date', startDate);

  if (deleteError) throw deleteError;

  const { data, error } = await client
    .from('period_logs')
    .insert({
      user_id: userId,
      start_date: startDate,
      duration,
      selected_dates: getConsecutiveDatesFromStart({ year, monthIndex, startDay, duration }),
      has_started: hasStarted,
      flow_status: flowStatus,
      pain_level: painLevel,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const replacePeriodLog = createPeriodLog;

export const deletePeriodLogByStartDate = async ({ userId, startDate }) => {
  const client = requireSupabase();

  const { error } = await client
    .from('period_logs')
    .delete()
    .eq('user_id', userId)
    .eq('start_date', startDate);

  if (error) throw error;
};

export const deletePeriodLogsByMonth = async ({ userId, year, monthIndex }) => {
  const client = requireSupabase();
  const monthRange = getMonthRange(year, monthIndex);

  const { error } = await client
    .from('period_logs')
    .delete()
    .eq('user_id', userId)
    .gte('start_date', monthRange.start)
    .lt('start_date', monthRange.end);

  if (error) throw error;
};

export const createPeriodLogs = async ({ userId, logs }) => {
  if (!logs.length) return [];

  const client = requireSupabase();
  const rowsByMonth = new Map();

  logs.forEach((log) => {
    rowsByMonth.set(log.start_date.slice(0, 7), {
      user_id: userId,
      start_date: log.start_date,
      duration: log.duration,
      selected_dates: log.selected_dates,
      has_started: log.has_started,
      flow_status: log.flow_status,
      pain_level: log.pain_level,
    });
  });

  const rows = Array.from(rowsByMonth.values());

  const { data, error } = await client
    .from('period_logs')
    .insert(rows)
    .select();

  if (error) throw error;

  return data;
};

export const getPeriodLogs = async ({ userId }) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from('period_logs')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });

  if (error) throw error;

  return data;
};

export const deleteAllPeriodLogs = async ({ userId }) => {
  const client = requireSupabase();

  const { error } = await client
    .from('period_logs')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
};
