/**
 * Local business time for Pasta Pasta — Asia/Tashkent (UTC+5, no DST).
 * We store wall-clock local strings like "2026-07-17 18:05:12" for display/stats.
 */

const TZ = 'Asia/Tashkent';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Current local datetime: "YYYY-MM-DD HH:mm:ss" */
function nowLocal() {
  return formatLocal(new Date());
}

/** Current local date: "YYYY-MM-DD" */
function todayLocal() {
  return nowLocal().slice(0, 10);
}

/**
 * Format a Date (or ms) as Tashkent wall clock "YYYY-MM-DD HH:mm:ss"
 */
function formatLocal(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  // en-CA gives YYYY-MM-DD; use formatToParts for reliable time
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  // Some engines emit "24" for midnight
  if (hour === '24') hour = '00';
  const minute = get('minute');
  const second = get('second');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/** Local time only HH:mm:ss */
function timeLocal(input = new Date()) {
  return formatLocal(input).slice(11);
}

module.exports = {
  TZ,
  nowLocal,
  todayLocal,
  formatLocal,
  timeLocal,
};
