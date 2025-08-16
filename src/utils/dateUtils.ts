import { DateTime } from 'luxon';

/**
 * Get the current New Zealand financial year dates (April 1 - March 31)
 * @returns Object with start and end dates of the current NZ financial year
 */
export function getCurrentNZFinancialYear(): { start: DateTime; end: DateTime } {
  const now = DateTime.now().setZone('Pacific/Auckland');
  
  // NZ financial year runs from April 1 to March 31
  let startYear = now.year;
  
  // If we're in Jan-Mar, the financial year started in the previous calendar year
  if (now.month < 4) {
    startYear = now.year - 1;
  }
  
  const start = DateTime.fromObject(
    { year: startYear, month: 4, day: 1 },
    { zone: 'Pacific/Auckland' }
  ).startOf('day');
  
  const end = DateTime.fromObject(
    { year: startYear + 1, month: 3, day: 31 },
    { zone: 'Pacific/Auckland' }
  ).endOf('day');
  
  return { start, end };
}

/**
 * Generate array of month periods for a given date range
 * @param start Start date
 * @param end End date
 * @returns Array of objects with start and end dates for each month
 */
export function getMonthlyPeriods(start: DateTime, end: DateTime): Array<{ start: DateTime; end: DateTime; year: number; month: number }> {
  const periods: Array<{ start: DateTime; end: DateTime; year: number; month: number }> = [];
  
  let current = start.startOf('month');
  const endMonth = end.endOf('month');
  
  while (current <= endMonth) {
    const monthEnd = current.endOf('month');
    const periodEnd = monthEnd < end ? monthEnd : end;
    
    periods.push({
      start: current >= start ? current : start,
      end: periodEnd,
      year: current.year,
      month: current.month
    });
    
    current = current.plus({ months: 1 }).startOf('month');
  }
  
  return periods;
}

/**
 * Format date for PocketSmith API (YYYY-MM-DD)
 * @param date DateTime object
 * @returns Formatted date string
 */
export function formatDateForAPI(date: DateTime): string {
  return date.toISODate() || '';
}
