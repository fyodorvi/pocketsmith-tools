import { DateTime } from 'luxon';
import { PocketSmithEvent } from './types.js';
import { getCurrentNZFinancialYear } from './utils/dateUtils.js';

export interface DailySpendingMap {
  [dateString: string]: number; // YYYY-MM-DD -> daily spending amount
}

/**
 * Build a map of per-day planned spending during the financial year
 * 
 * Rules:
 * 1. Bills (is_bill: true) are spent on their specific date
 * 2. Non-bills (is_bill: false) are prorated based on repeat cadence:
 *    - Monthly: prorated across the specific month(s) 
 *    - Yearly: prorated across the entire financial year
 * 3. Transfers (is_transfer: true) are ignored
 * 4. Credit Card Repayments category is always ignored
 * 
 * @param events Array of PocketSmith events
 * @returns Map of date strings to daily spending amounts
 */
export function buildDailySpendingMap(events: PocketSmithEvent[]): DailySpendingMap {
  const { start: fyStart, end: fyEnd } = getCurrentNZFinancialYear();
  const dailySpending: DailySpendingMap = {};

  // Initialize all days in the financial year with 0
  let currentDate = fyStart.startOf('day');
  while (currentDate <= fyEnd.startOf('day')) {
    dailySpending[currentDate.toISODate()!] = 0;
    currentDate = currentDate.plus({ days: 1 });
  }

  for (const event of events) {
    // Skip transfers
    if (event.is_transfer) {
      continue;
    }

    // Skip Credit Card Repayments category
    if (event.category.title === "Credit Card Repayments 💳") {
      continue;
    }

    const eventDate = DateTime.fromISO(event.date).setZone('Pacific/Auckland');
    
    // Skip events outside the financial year
    if (eventDate < fyStart.startOf('day') || eventDate > fyEnd.startOf('day')) {
      continue;
    }

    const amount = Math.abs(event.amount); // Use absolute value for spending

    if (event.category.is_bill) {
      // Bills: Simple spending on the specific date
      const dateKey = eventDate.toISODate()!;
      dailySpending[dateKey] = (dailySpending[dateKey] || 0) + amount;
    } else {
      // Non-bills: Prorated spending based on repeat pattern
      const { dailyAmount, startDate, endDate } = calculateProratedSpending(event, eventDate, fyStart, fyEnd);
      
      // Add the daily prorated amount to each day in the proration period
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISODate()!;
        dailySpending[dateKey] = (dailySpending[dateKey] || 0) + dailyAmount;
        currentDate = currentDate.plus({ days: 1 });
      }
    }
  }

  return dailySpending;
}

/**
 * Calculate the prorated spending for non-bill events
 * @param event PocketSmith event
 * @param eventDate The date of the event
 * @param fyStart Financial year start
 * @param fyEnd Financial year end
 * @returns Object with daily amount and the period to apply it over
 */
function calculateProratedSpending(
  event: PocketSmithEvent,
  eventDate: DateTime,
  fyStart: DateTime,
  fyEnd: DateTime
): { dailyAmount: number; startDate: DateTime; endDate: DateTime } {
  const amount = Math.abs(event.amount);
  const repeatType = event.repeat_type;
  const repeatInterval = event.repeat_interval;

  let startDate: DateTime;
  let endDate: DateTime;
  let totalDays: number;

  switch (repeatType) {
    case 'monthly':
      // For monthly: prorate over the specific month(s) based on interval
      // If interval is 1, just this month. If interval is 3, next 3 months, etc.
      startDate = eventDate.startOf('month');
      endDate = startDate.plus({ months: repeatInterval }).minus({ days: 1 }).endOf('day');
      
      // Ensure we don't go beyond the financial year
      if (startDate < fyStart) startDate = fyStart;
      if (endDate > fyEnd) endDate = fyEnd;
      
      totalDays = endDate.diff(startDate, 'days').days + 1;
      break;
    
    case 'yearly':
      // For yearly: prorate over the entire financial year (or the interval years)
      startDate = fyStart;
      endDate = fyEnd;
      totalDays = endDate.diff(startDate, 'days').days + 1;
      break;
    
    default:
      // For unknown repeat types, assume monthly
      console.warn(`Unknown repeat_type: ${repeatType}, assuming monthly`);
      startDate = eventDate.startOf('month');
      endDate = startDate.plus({ months: repeatInterval }).minus({ days: 1 }).endOf('day');
      
      if (startDate < fyStart) startDate = fyStart;
      if (endDate > fyEnd) endDate = fyEnd;
      
      totalDays = endDate.diff(startDate, 'days').days + 1;
      break;
  }

  const dailyAmount = amount / totalDays;

  return { dailyAmount, startDate, endDate };
}

/**
 * Get total spending for a specific date
 * @param dailySpending Daily spending map
 * @param date Date to get spending for
 * @returns Total spending amount for the date
 */
export function getSpendingForDate(dailySpending: DailySpendingMap, date: DateTime): number {
  const dateKey = date.toISODate()!;
  return dailySpending[dateKey] || 0;
}

/**
 * Get total spending for a date range
 * @param dailySpending Daily spending map
 * @param startDate Start date (inclusive)
 * @param endDate End date (inclusive)
 * @returns Total spending amount for the date range
 */
export function getSpendingForDateRange(
  dailySpending: DailySpendingMap,
  startDate: DateTime,
  endDate: DateTime
): number {
  let total = 0;
  let currentDate = startDate.startOf('day');
  
  while (currentDate <= endDate.startOf('day')) {
    total += getSpendingForDate(dailySpending, currentDate);
    currentDate = currentDate.plus({ days: 1 });
  }
  
  return total;
}

/**
 * Get spending statistics for the financial year
 * @param dailySpending Daily spending map
 * @returns Statistics object
 */
export function getSpendingStatistics(dailySpending: DailySpendingMap) {
  const amounts = Object.values(dailySpending);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const average = total / amounts.length;
  const max = Math.max(...amounts);
  const min = Math.min(...amounts);

  return {
    total,
    average,
    max,
    min,
    daysCount: amounts.length
  };
}
