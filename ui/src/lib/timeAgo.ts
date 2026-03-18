import { getCurrentLanguage } from "../i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

function formatRelative(value: number, unit: Intl.RelativeTimeFormatUnit) {
  const language = getCurrentLanguage();
  const locale = language === "zh-CN" ? "zh-CN" : "en";
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}

export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);

  if (seconds < MINUTE) return formatRelative(0, "second");
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return formatRelative(-m, "minute");
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return formatRelative(-h, "hour");
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return formatRelative(-d, "day");
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return formatRelative(-w, "week");
  }
  const mo = Math.floor(seconds / MONTH);
  return formatRelative(-mo, "month");
}
