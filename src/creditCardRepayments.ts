import { DateTime } from 'luxon';
import { DailySpendingMap, getSpendingForDateRange } from './dailySpendingMap';
import { PocketSmithEvent } from './types';

export interface BillBreakdown {
  /** Individual bill event */
  event: PocketSmithEvent;
  /** Amount for this specific bill */
  amount: number;
  /** Date this bill occurs */
  date: DateTime;
}

export interface CategoryBreakdown {
  /** Category title */
  categoryTitle: string;
  /** Total amount for this category in the period */
  totalAmount: number;
  /** Individual bills in this category */
  bills: BillBreakdown[];
  /** Prorated amount from non-bill events */
  proratedAmount: number;
}

export interface CreditCardBillingPeriod {
  /** The month and year this repayment is due (e.g., "2024-08" for August 2024) */
  repaymentMonth: string;
  /** Start date of the billing period (3rd of the month) */
  periodStart: DateTime;
  /** End date of the billing period (2nd of next month) */
  periodEnd: DateTime;
  /** Total spending during this billing period */
  totalSpending: number;
  /** Breakdown by category */
  categoryBreakdown: CategoryBreakdown[];
}

/**
 * Generate credit card billing periods starting from the current month
 * Credit card billing period: 3rd of each month to 2nd of the next month
 * Repayment is due in the month following the billing period end
 * 
 * @param dailySpending Daily spending map
 * @param allEvents All PocketSmith events for category breakdown analysis
 * @returns Array of billing periods with repayment amounts and category breakdowns
 */
export function calculateCreditCardRepayments(
  dailySpending: DailySpendingMap, 
  allEvents: PocketSmithEvent[]
): CreditCardBillingPeriod[] {
  const now = DateTime.now().setZone('Pacific/Auckland');
  const currentMonth = now.month;
  const currentYear = now.year;
  
  // Find all available dates in the spending map
  const availableDates = Object.keys(dailySpending)
    .map(dateStr => DateTime.fromISO(dateStr))
    .sort((a, b) => a.toMillis() - b.toMillis());
  
  if (availableDates.length === 0) {
    return [];
  }
  
  const earliestDate = availableDates[0];
  const latestDate = availableDates[availableDates.length - 1];
  
  const billingPeriods: CreditCardBillingPeriod[] = [];
  
  // Start from the earliest possible billing period that has complete data
  // We need a billing period to have data from 3rd to 2nd of next month
  let startMonth = earliestDate.month;
  let startYear = earliestDate.year;
  
  // If earliest date is after the 3rd, we need to start from the next month
  if (earliestDate.day > 3) {
    if (startMonth === 12) {
      startMonth = 1;
      startYear++;
    } else {
      startMonth++;
    }
  }
  
  // Generate billing periods
  let currentBillingMonth = startMonth;
  let currentBillingYear = startYear;
  
  while (true) {
    // Calculate billing period dates
    const periodStart = DateTime.fromObject({
      year: currentBillingYear,
      month: currentBillingMonth,
      day: 3
    }).setZone('Pacific/Auckland').startOf('day');
    
    let nextMonth = currentBillingMonth + 1;
    let nextYear = currentBillingYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    
    const periodEnd = DateTime.fromObject({
      year: nextYear,
      month: nextMonth,
      day: 2
    }).setZone('Pacific/Auckland').endOf('day');
    
    // Check if we have complete data for this period
    if (periodEnd > latestDate) {
      break;
    }
    
    // Calculate repayment month (month after period ends)
    let repaymentMonth = nextMonth;
    let repaymentYear = nextYear;
    
    // Only include repayments from current month onwards
    const repaymentDate = DateTime.fromObject({
      year: repaymentYear,
      month: repaymentMonth,
      day: 1
    });
    
    const currentMonthDate = DateTime.fromObject({
      year: currentYear,
      month: currentMonth,
      day: 1
    });
    
    if (repaymentDate >= currentMonthDate) {
      // Calculate total spending for this billing period
      const totalSpending = getSpendingForDateRange(dailySpending, periodStart, periodEnd);
      
      // Calculate category breakdown for this period
      const categoryBreakdown = calculateCategoryBreakdown(allEvents, periodStart, periodEnd);
      
      billingPeriods.push({
        repaymentMonth: `${repaymentYear}-${repaymentMonth.toString().padStart(2, '0')}`,
        periodStart,
        periodEnd,
        totalSpending,
        categoryBreakdown
      });
    }
    
    // Move to next billing period
    currentBillingMonth++;
    if (currentBillingMonth > 12) {
      currentBillingMonth = 1;
      currentBillingYear++;
    }
  }
  
  return billingPeriods;
}

/**
 * Display credit card repayment information
 * @param repayments Array of billing periods with repayment amounts
 */
export function displayCreditCardRepayments(repayments: CreditCardBillingPeriod[]): void {
  console.log('');
  console.log('💳 Credit Card Repayment Schedule');
  console.log('=================================');
  console.log('Billing Period: 3rd of each month to 2nd of next month');
  console.log('Repayment Due: Following month after billing period ends');
  console.log('');
  
  if (repayments.length === 0) {
    console.log('❌ No repayment data available - insufficient spending data');
    return;
  }
  
  let totalRepayments = 0;
  
  repayments.forEach((period, index) => {
    const periodStartStr = period.periodStart.toFormat('MMM d, yyyy');
    const periodEndStr = period.periodEnd.toFormat('MMM d, yyyy');
    
    // Format month as "2026 Jan" instead of "2026-01"
    const [year, monthNum] = period.repaymentMonth.split('-');
    const monthName = DateTime.fromObject({ month: parseInt(monthNum) }).toFormat('MMM');
    const formattedMonth = `${year} ${monthName}`;
    
    console.log(`${formattedMonth}: $${period.totalSpending.toFixed(2)}`);
    console.log(`  Billing Period: ${periodStartStr} - ${periodEndStr}`);
    
    // Show category breakdown
    if (period.categoryBreakdown.length > 0) {
      console.log('  Category Breakdown:');
      
      // Separate bills and prorated categories
      const billCategories = period.categoryBreakdown.filter(cat => cat.bills.length > 0);
      const proratedCategories = period.categoryBreakdown.filter(cat => cat.proratedAmount > 0 && cat.bills.length === 0);
      
      // Show bills first
      billCategories.forEach(category => {
        console.log(`    ${category.categoryTitle}: $${category.totalAmount.toFixed(2)}`);
        
        // Show individual bills
        category.bills.forEach(bill => {
          const billDateStr = bill.date.toFormat('MMM d');
          const note = bill.event.note ? ` (${bill.event.note})` : '';
          console.log(`      • ${billDateStr}: $${bill.amount.toFixed(2)}${note}`);
        });
        
        // If there's also prorated amount in this category, show it
        if (category.proratedAmount > 0) {
          console.log(`      • Prorated: $${category.proratedAmount.toFixed(2)}`);
        }
      });
      
      // Show prorated categories
      proratedCategories.forEach(category => {
        console.log(`    ${category.categoryTitle}: $${category.totalAmount.toFixed(2)}`);
      });
    }
    
    totalRepayments += period.totalSpending;
    
    // Add spacing between entries (but not after the last one)
    if (index < repayments.length - 1) {
      console.log('');
    }
  });
  
  console.log('');
  console.log(`📊 Summary: ${repayments.length} repayment periods, total: $${totalRepayments.toFixed(2)}`);
  console.log(`📈 Average monthly repayment: $${(totalRepayments / repayments.length).toFixed(2)}`);
}

/**
 * Calculate category breakdown for a billing period
 * @param allEvents All PocketSmith events
 * @param periodStart Start of billing period
 * @param periodEnd End of billing period
 * @returns Array of category breakdowns
 */
function calculateCategoryBreakdown(
  allEvents: PocketSmithEvent[], 
  periodStart: DateTime, 
  periodEnd: DateTime
): CategoryBreakdown[] {
  // Filter events that are relevant for this period
  const relevantEvents = allEvents.filter(event => {
    // Skip transfers and credit card repayments
    if (event.is_transfer || event.category.title === "Credit Card Repayments 💳") {
      return false;
    }
    
    const eventDate = DateTime.fromISO(event.date).setZone('Pacific/Auckland');
    
    // For bills: include if the event date falls within the period
    if (event.category.is_bill) {
      return eventDate >= periodStart.startOf('day') && eventDate <= periodEnd.endOf('day');
    }
    
    // For non-bills: include if their proration period overlaps with billing period
    return doesProratedEventOverlapPeriod(event, eventDate, periodStart, periodEnd);
  });
  
  // Group by category
  const categoryMap = new Map<string, CategoryBreakdown>();
  
  for (const event of relevantEvents) {
    const categoryTitle = event.category.title;
    const amount = Math.abs(event.amount);
    
    if (!categoryMap.has(categoryTitle)) {
      categoryMap.set(categoryTitle, {
        categoryTitle,
        totalAmount: 0,
        bills: [],
        proratedAmount: 0
      });
    }
    
    const category = categoryMap.get(categoryTitle)!;
    
    if (event.category.is_bill) {
      // Add as individual bill
      const eventDate = DateTime.fromISO(event.date).setZone('Pacific/Auckland');
      category.bills.push({
        event,
        amount,
        date: eventDate
      });
      category.totalAmount += amount;
    } else {
      // Calculate prorated amount for this period
      const proratedAmount = calculateProratedAmountForPeriod(event, periodStart, periodEnd);
      category.proratedAmount += proratedAmount;
      category.totalAmount += proratedAmount;
    }
  }
  
  // Convert to array and filter out categories with zero amounts
  return Array.from(categoryMap.values())
    .filter(category => category.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount); // Sort by amount descending
}

/**
 * Check if a prorated event overlaps with the billing period
 */
function doesProratedEventOverlapPeriod(
  event: PocketSmithEvent, 
  eventDate: DateTime, 
  periodStart: DateTime, 
  periodEnd: DateTime
): boolean {
  // Get the proration period for this event
  const { startDate, endDate } = calculateEventProratedPeriod(event, eventDate);
  
  // Check if periods overlap
  return startDate <= periodEnd && endDate >= periodStart;
}

/**
 * Calculate the prorated amount for a non-bill event within a specific period
 */
function calculateProratedAmountForPeriod(
  event: PocketSmithEvent, 
  periodStart: DateTime, 
  periodEnd: DateTime
): number {
  const eventDate = DateTime.fromISO(event.date).setZone('Pacific/Auckland');
  const { startDate, endDate, dailyAmount } = calculateEventProratedPeriod(event, eventDate);
  
  // Find the overlap between event proration period and billing period
  const overlapStart = startDate > periodStart ? startDate : periodStart;
  const overlapEnd = endDate < periodEnd ? endDate : periodEnd;
  
  if (overlapStart > overlapEnd) {
    return 0; // No overlap
  }
  
  const overlapDays = overlapEnd.diff(overlapStart, 'days').days + 1;
  return dailyAmount * overlapDays;
}

/**
 * Calculate the proration period for an event (similar to dailySpendingMap logic)
 */
function calculateEventProratedPeriod(
  event: PocketSmithEvent, 
  eventDate: DateTime
): { startDate: DateTime; endDate: DateTime; dailyAmount: number } {
  const amount = Math.abs(event.amount);
  const repeatType = event.repeat_type;
  const repeatInterval = event.repeat_interval;
  
  // Get current financial year bounds
  const now = DateTime.now().setZone('Pacific/Auckland');
  let fyStartYear = now.year;
  if (now.month < 4) {
    fyStartYear = now.year - 1;
  }
  
  const fyStart = DateTime.fromObject(
    { year: fyStartYear, month: 4, day: 1 },
    { zone: 'Pacific/Auckland' }
  ).startOf('day');
  
  const fyEnd = DateTime.fromObject(
    { year: fyStartYear + 1, month: 3, day: 31 },
    { zone: 'Pacific/Auckland' }
  ).endOf('day');
  
  let startDate: DateTime;
  let endDate: DateTime;
  let totalDays: number;
  
  switch (repeatType) {
    case 'monthly':
      startDate = eventDate.startOf('month');
      endDate = startDate.plus({ months: repeatInterval }).minus({ days: 1 }).endOf('day');
      
      if (startDate < fyStart) startDate = fyStart;
      if (endDate > fyEnd) endDate = fyEnd;
      
      totalDays = endDate.diff(startDate, 'days').days + 1;
      break;
    
    case 'yearly':
      startDate = fyStart;
      endDate = fyEnd;
      totalDays = endDate.diff(startDate, 'days').days + 1;
      break;
    
    default:
      // Assume monthly for unknown types
      startDate = eventDate.startOf('month');
      endDate = startDate.plus({ months: repeatInterval }).minus({ days: 1 }).endOf('day');
      
      if (startDate < fyStart) startDate = fyStart;
      if (endDate > fyEnd) endDate = fyEnd;
      
      totalDays = endDate.diff(startDate, 'days').days + 1;
      break;
  }
  
  const dailyAmount = amount / totalDays;
  
  return { startDate, endDate, dailyAmount };
}
