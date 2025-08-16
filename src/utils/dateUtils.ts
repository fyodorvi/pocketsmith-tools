import {
  format,
  parseISO,
  isWithinInterval,
  isBefore,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addMonths
} from 'date-fns';

export function getMonthlyRanges(startDate: Date, endDate: Date): { start: Date; end: Date }[] {
  const ranges = [];
  let currentStart = startOfMonth(startDate);

  while (isBefore(currentStart, endDate)) {
    const monthEnd = endOfMonth(currentStart);

    // Adjust the end date if it goes beyond our target end date
    const rangeEnd = isBefore(monthEnd, endDate) ? monthEnd : endOfDay(endDate);

    ranges.push({
      start: startOfDay(currentStart),
      end: rangeEnd
    });

    // Move to next month
    currentStart = startOfMonth(addMonths(currentStart, 1));
  }

  return ranges;
}

export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getCacheFileName(startDate: Date, endDate: Date): string {
  // Use month-based naming for cache files
  return `events-${format(startDate, 'yyyy-MM')}.json`;
}

export function isDateInRange(date: Date, range: { start: Date; end: Date }): boolean {
  return isWithinInterval(parseISO(date.toString()), {
    start: range.start,
    end: range.end
  });
}
