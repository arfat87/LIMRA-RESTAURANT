/**
 * Format UTC date string to IST display
 * Output: "10 Jun 2026, 07:15 PM"
 */
export const formatDate = (utcString: string): string => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(utcString));
};

/**
 * Format date only (no time)
 * Output: "10 Jun 2026"
 */
export const formatDateOnly = (utcString: string): string => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(utcString));
};

/**
 * Relative time e.g. "2 hours ago"
 */
export const formatRelative = (utcString: string): string => {
  const diff = Date.now() - new Date(utcString).getTime();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return rtf.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.floor(hours / 24), 'day');
};
