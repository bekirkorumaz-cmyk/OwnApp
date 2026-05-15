import * as SQLite from 'expo-sqlite';

let databasePromise;

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('the_rhythm.db');
  }

  return databasePromise;
};

export const initLocalDatabase = async () => {
  const database = await getDatabase();

  await database.execAsync(`
    create table if not exists period_logs (
      id integer primary key autoincrement,
      start_date text not null,
      duration integer not null,
      selected_dates text not null,
      has_started integer not null default 1,
      flow_status text not null,
      pain_level text not null,
      created_at text not null default current_timestamp
    );
  `);
};

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

const serializeLocalLog = ({
  year,
  monthIndex,
  startDay,
  duration,
  hasStarted,
  flowStatus,
  painLevel,
}) => ({
  startDate: toDateString(year, monthIndex, startDay),
  monthRange: getMonthRange(year, monthIndex),
  duration,
  selectedDates: getConsecutiveDatesFromStart({ year, monthIndex, startDay, duration }),
  hasStarted,
  flowStatus,
  painLevel,
});

const insertLocalPeriodLog = async (database, log) => {
  const result = await database.runAsync(
    `insert into period_logs
      (start_date, duration, selected_dates, has_started, flow_status, pain_level)
      values (?, ?, ?, ?, ?, ?)`,
    [
      log.startDate,
      log.duration,
      JSON.stringify(log.selectedDates),
      log.hasStarted ? 1 : 0,
      log.flowStatus,
      log.painLevel,
    ]
  );

  return { id: result.lastInsertRowId, ...log };
};

export const createLocalPeriodLog = async (input) => {
  await initLocalDatabase();
  const database = await getDatabase();
  const log = serializeLocalLog(input);

  await database.runAsync(
    'delete from period_logs where start_date = ?',
    [log.startDate]
  );

  return insertLocalPeriodLog(database, log);
};

export const replaceLocalPeriodLog = createLocalPeriodLog;

export const deleteLocalPeriodLogByStartDate = async (startDate) => {
  await initLocalDatabase();
  const database = await getDatabase();
  await database.runAsync('delete from period_logs where start_date = ?', [startDate]);
};

export const deleteLocalPeriodLogsByMonth = async (year, monthIndex) => {
  await initLocalDatabase();
  const database = await getDatabase();
  const monthRange = getMonthRange(year, monthIndex);
  await database.runAsync(
    'delete from period_logs where start_date >= ? and start_date < ?',
    [monthRange.start, monthRange.end]
  );
};

export const getLocalPeriodLogs = async () => {
  await initLocalDatabase();
  const database = await getDatabase();
  const rows = await database.getAllAsync('select * from period_logs order by start_date desc, id desc');

  return rows.map((row) => ({
    id: row.id,
    start_date: row.start_date,
    duration: row.duration,
    selected_dates: JSON.parse(row.selected_dates),
    has_started: Boolean(row.has_started),
    flow_status: row.flow_status,
    pain_level: row.pain_level,
    created_at: row.created_at,
  }));
};

export const clearLocalPeriodLogs = async () => {
  await initLocalDatabase();
  const database = await getDatabase();
  await database.runAsync('delete from period_logs');
};
