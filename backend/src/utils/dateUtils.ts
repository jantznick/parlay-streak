/**
 * Backend date and timezone utility functions
 * Used for converting user's local date/timezone to UTC date ranges for database queries
 */

/**
 * Parse date and timezone offset from request query parameters
 * @param req - Express request object
 * @returns Object with date string and timezone offset in hours
 */
export function parseDateAndTimezone(req: { query: any }): {
  date: string | undefined;
  timezoneOffset: number | undefined;
} {
  const date = req.query.date as string | undefined;
  const timezoneOffset = req.query.timezoneOffset
    ? parseInt(req.query.timezoneOffset as string, 10)
    : undefined;

  return { date, timezoneOffset };
}

/**
 * Get local date string from date or timezone offset
 * If date is provided, use it. Otherwise, calculate from timezone offset or use server date.
 * @param date - Optional date string in YYYY-MM-DD format
 * @param timezoneOffset - Optional timezone offset in hours
 * @returns Date string in YYYY-MM-DD format
 */
export function getLocalDateString(
  date?: string,
  timezoneOffset?: number
): string {
  if (date) {
    // Use the provided date (user's local date)
    return date;
  } else if (timezoneOffset !== undefined) {
    // Calculate what date it is in the user's timezone
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const localTime = utcTime + timezoneOffset * 60 * 60 * 1000;
    const localDate = new Date(localTime);
    return localDate.toISOString().split('T')[0];
  } else {
    // Fallback to server's local date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Convert a date string and timezone offset to UTC date range
 * @param dateStr - Date in YYYY-MM-DD format (user's local date)
 * @param timezoneOffset - Timezone offset in hours (e.g., -5 for EST, -6 for CST)
 * @returns Object with start and end UTC dates for the date range
 */
export function getUTCDateRange(
  dateStr: string,
  timezoneOffset: number | undefined
): { start: Date; end: Date } {
  // Parse date components
  const [year, month, day] = dateStr.split('-').map(Number);

  // Default to UTC if no timezone offset provided (backward compatibility)
  const offset = timezoneOffset ?? 0;

  // Create date representing midnight in the user's timezone
  // We create it as UTC first, then adjust by the offset
  const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Convert to UTC by subtracting the offset (offset is hours, convert to milliseconds)
  // If user is in EST (UTC-5), offset is -5, so we subtract -5 hours = add 5 hours to get UTC
  const startUTC = new Date(localMidnight.getTime() - offset * 60 * 60 * 1000);

  // End is 24 hours later
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  return { start: startUTC, end: endUTC };
}

