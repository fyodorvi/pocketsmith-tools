import dotenv from 'dotenv';
import { PocketSmithClient } from './pocketsmith';
import { getCurrentNZFinancialYear, getMonthlyPeriods } from './utils/dateUtils';
import { loadCachedEvents, saveCachedEvents, getCacheMetadata } from './utils/fileUtils';
import { Config, PocketSmithEvent } from './types';
import { buildDailySpendingMap, getSpendingStatistics, getSpendingForDate } from './dailySpendingMap';
import { calculateCreditCardRepayments, displayCreditCardRepayments } from './creditCardRepayments';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
function loadConfig(): Config {
  const apiKey = process.env.PS_API_KEY;
  const scenarioId = process.env.PS_SCENARIO_ID;

  if (!apiKey) {
    throw new Error('PS_API_KEY is required in .env file');
  }

  if (!scenarioId) {
    throw new Error('PS_SCENARIO_ID is required in .env file');
  }

  return {
    apiKey,
    scenarioId
  };
}

/**
 * Fetch or load cached events for a specific month
 */
async function getMonthlyEvents(
  client: PocketSmithClient, 
  year: number, 
  month: number
): Promise<PocketSmithEvent[]> {
  // Check if we have cached data
  const cachedEvents = await loadCachedEvents(year, month);
  
  if (cachedEvents) {
    const metadata = await getCacheMetadata(year, month);
    console.log(`Using cached events for ${year}-${month.toString().padStart(2, '0')} (${cachedEvents.length} events, cached at ${metadata?.cachedAt})`);
    return cachedEvents;
  }

  // Fetch from API and cache
  console.log(`No cache found for ${year}-${month.toString().padStart(2, '0')}, fetching from API...`);
  const events = await client.fetchMonthlyEvents(year, month);
  await saveCachedEvents(year, month, events);
  
  return events;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 PocketSmith Tools - Credit Card Repayment Calculator');
    console.log('====================================================');

    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Initialize PocketSmith client
    const client = new PocketSmithClient(config);
    console.log('✅ PocketSmith client initialized');

    // Get current NZ financial year
    const { start, end } = getCurrentNZFinancialYear();
    console.log(`📅 Current NZ Financial Year: ${start.toISODate()} to ${end.toISODate()}`);

    // Get monthly periods for the financial year
    const monthlyPeriods = getMonthlyPeriods(start, end);
    console.log(`📊 Processing ${monthlyPeriods.length} months of data`);

    // Fetch events for each month
    const allEvents: PocketSmithEvent[] = [];
    
    for (const period of monthlyPeriods) {
      const events = await getMonthlyEvents(client, period.year, period.month);
      allEvents.push(...events);
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('');
    console.log('📈 Summary:');
    console.log(`Total events loaded: ${allEvents.length}`);
    console.log(`Date range: ${start.toISODate()} to ${end.toISODate()}`);
    
    // Group events by month for summary
    const eventsByMonth = monthlyPeriods.map(period => {
      const monthEvents = allEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getFullYear() === period.year && eventDate.getMonth() + 1 === period.month;
      });
      
      return {
        period: `${period.year}-${period.month.toString().padStart(2, '0')}`,
        count: monthEvents.length,
        totalAmount: monthEvents.reduce((sum, event) => sum + event.amount, 0)
      };
    });

    console.log('');
    console.log('Monthly breakdown:');
    eventsByMonth.forEach(({ period, count, totalAmount }) => {
      console.log(`  ${period}: ${count} events, total: $${totalAmount.toFixed(2)}`);
    });

    console.log('');
    console.log('🗓️  Building daily spending map...');
    
    // Build the daily spending map
    const dailySpending = buildDailySpendingMap(allEvents);
    const stats = getSpendingStatistics(dailySpending);
    
    console.log('');
    console.log('💰 Daily Spending Analysis:');
    console.log(`Total planned annual spending: $${stats.total.toFixed(2)}`);
    console.log(`Average daily spending: $${stats.average.toFixed(2)}`);
    console.log(`Maximum daily spending: $${stats.max.toFixed(2)}`);
    console.log(`Minimum daily spending: $${stats.min.toFixed(2)}`);
    
    // Show spending breakdown
    const transferEvents = allEvents.filter(event => event.is_transfer);
    const creditCardRepaymentEvents = allEvents.filter(event => event.category.title === "Credit Card Repayments 💳");
    const processedEvents = allEvents.filter(event => 
      !event.is_transfer && event.category.title !== "Credit Card Repayments 💳"
    );
    const billEvents = processedEvents.filter(event => event.category.is_bill);
    const nonBillEvents = processedEvents.filter(event => !event.category.is_bill);
    
    console.log('');
    console.log('📊 Event Breakdown:');
    console.log(`Bills: ${billEvents.length} events`);
    console.log(`Non-bills: ${nonBillEvents.length} events`);
    console.log(`Transfers (ignored): ${transferEvents.length} events`);
    if (creditCardRepaymentEvents.length > 0) {
      console.log(`Credit Card Repayments (ignored): ${creditCardRepaymentEvents.length} events`);
    }
    
    // Show a sample of daily spending
    console.log('');
    console.log('📅 Sample Daily Spending (next 7 days):');
    const today = start.startOf('day');
    for (let i = 0; i < 7; i++) {
      const date = today.plus({ days: i });
      const spending = getSpendingForDate(dailySpending, date);
      console.log(`  ${date.toISODate()}: $${spending.toFixed(2)}`);
    }

    console.log('');
    console.log('✅ Daily spending map complete! Calculating credit card repayments...');
    
    // Calculate credit card repayments
    const creditCardRepayments = calculateCreditCardRepayments(dailySpending, allEvents);
    displayCreditCardRepayments(creditCardRepayments);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}
