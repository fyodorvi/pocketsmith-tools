import dotenv from 'dotenv';
import { PocketSmithClient } from './pocketsmith';
import { getCurrentNZFinancialYear, getMonthlyPeriods } from './utils/dateUtils';
import { loadCachedEvents, saveCachedEvents, getCacheMetadata } from './utils/fileUtils';
import { Config, PocketSmithEvent } from './types';
import { buildDailySpendingMap, getSpendingStatistics, getSpendingForDate, DailySpendingMap } from './dailySpendingMap';
import { 
  calculateCreditCardRepayments, 
  displayCreditCardRepayments, 
  displayRepaymentSummary,
  applyHeadroomToRepayments,
  displayRepaymentSummaryWithHeadroom,
  findCreditCardRepaymentEvents,
  updateCreditCardRepaymentEvents
} from './creditCardRepayments';
import { confirmAction, getPercentageInput } from './utils/inputUtils';
import inquirer from 'inquirer';

// Load environment variables
dotenv.config();

// Global application state
let appConfig: Config | null = null;
let pocketSmithClient: PocketSmithClient | null = null;
let allEvents: PocketSmithEvent[] = [];
let dailySpending: DailySpendingMap = {};

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
  month: number,
  forceRefresh: boolean = false
): Promise<PocketSmithEvent[]> {
  // If not forcing refresh, check if we have cached data
  if (!forceRefresh) {
    const cachedEvents = await loadCachedEvents(year, month);
    
    if (cachedEvents) {
      const metadata = await getCacheMetadata(year, month);
      console.log(`Using cached events for ${year}-${month.toString().padStart(2, '0')} (${cachedEvents.length} events, cached at ${metadata?.cachedAt})`);
      return cachedEvents;
    }
  }

  // Fetch from API and cache
  const cacheAction = forceRefresh ? 'Refreshing cache' : 'No cache found';
  console.log(`${cacheAction} for ${year}-${month.toString().padStart(2, '0')}, fetching from API...`);
  const events = await client.fetchMonthlyEvents(year, month);
  await saveCachedEvents(year, month, events);
  
  return events;
}

/**
 * Initialize the application configuration and client
 */
async function initializeApp(): Promise<void> {
  if (!appConfig) {
    appConfig = loadConfig();
    console.log('✅ Configuration loaded');
  }
  
  if (!pocketSmithClient) {
    pocketSmithClient = new PocketSmithClient(appConfig);
    console.log('✅ PocketSmith client initialized');
  }
}

/**
 * Clear the terminal screen
 */
function clearScreen(): void {
  console.clear();
}

/**
 * Fetch data from PocketSmith API and cache it
 */
async function fetchDataFromPocketSmith(): Promise<void> {
  try {
    clearScreen();
    console.log('🚀 Fetching data from PocketSmith...');
    console.log('====================================');

    await initializeApp();

    // Get current NZ financial year
    const { start, end } = getCurrentNZFinancialYear();
    console.log(`📅 Current NZ Financial Year: ${start.toISODate()} to ${end.toISODate()}`);

    // Get monthly periods for the financial year
    const monthlyPeriods = getMonthlyPeriods(start, end);
    console.log(`📊 Processing ${monthlyPeriods.length} months of data`);

    // Fetch events for each month (force refresh to ignore cache)
    allEvents = [];
    
    for (const period of monthlyPeriods) {
      const events = await getMonthlyEvents(pocketSmithClient!, period.year, period.month, true);
      allEvents.push(...events);
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('');
    console.log('📈 Summary:');
    console.log(`Total events loaded: ${allEvents.length}`);
    console.log(`Date range: ${start.toISODate()} to ${end.toISODate()}`);

    console.log('');
    console.log('🗓️  Building daily spending map...');
    
    // Build the daily spending map
    dailySpending = buildDailySpendingMap(allEvents);
    
    console.log('✅ Data fetched and processed successfully!');
    
  } catch (error) {
    console.error('❌ Error fetching data:', error);
    throw error;
  }
}

/**
 * Show monthly breakdown and spending analysis
 */
async function showMonthlyBreakdown(): Promise<void> {
  try {
    clearScreen();
    
    if (allEvents.length === 0) {
      console.log('⚠️  No data available. Please fetch data from PocketSmith first.');
      return;
    }

    console.log('📊 Monthly Breakdown & Spending Analysis');
    console.log('=======================================');

    const { start, end } = getCurrentNZFinancialYear();
    const monthlyPeriods = getMonthlyPeriods(start, end);
    
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

    const stats = getSpendingStatistics(dailySpending);
    
    console.log('');
    console.log('💰 Daily Spending Analysis:');
    console.log(`Total planned annual spending: $${stats.total.toFixed(2)}`);
    console.log(`Average daily spending: $${stats.average.toFixed(2)}`);
    console.log(`Maximum daily spending: $${stats.max.toFixed(2)}`);
    console.log(`Minimum daily spending: $${stats.min.toFixed(2)}`);
    
    // Show detailed credit card repayment breakdown
    console.log('');
    console.log('💳 Credit Card Repayment Analysis:');
    console.log('==================================');
    
    const creditCardRepayments = calculateCreditCardRepayments(dailySpending, allEvents);
    displayCreditCardRepayments(creditCardRepayments);

  } catch (error) {
    console.error('❌ Error showing breakdown:', error);
    throw error;
  }
}

/**
 * Calculate and update credit card repayments in PocketSmith
 */
async function updateCreditCardRepayments(): Promise<void> {
  try {
    clearScreen();
    
    if (allEvents.length === 0) {
      console.log('⚠️  No data available. Please fetch data from PocketSmith first.');
      return;
    }

    console.log('💳 Credit Card Repayment Calculator');
    console.log('===================================');

    await initializeApp();
    
    // Calculate credit card repayments
    const originalRepayments = calculateCreditCardRepayments(dailySpending, allEvents);

    // Show only summary, not full breakdown
    if (originalRepayments.length === 0) {
      console.log('');
      console.log('ℹ️  No credit card repayments to calculate.');
      return;
    }

    displayRepaymentSummary(originalRepayments);
    
    console.log('');
    const wantsHeadroom = await confirmAction('Do you want to add additional headroom to the repayment plan?');
    
    let finalRepayments = originalRepayments;
    
    if (wantsHeadroom) {
      let headroomPercentage = 0;
      let isHappyWithHeadroom = false;
      
      // Loop until user is happy with the headroom percentage
      while (!isHappyWithHeadroom) {
        console.log('');
        headroomPercentage = await getPercentageInput('Enter headroom percentage (e.g., 20 for 20%):');
        
        // Apply headroom and show new breakdown
        const adjustedRepayments = applyHeadroomToRepayments(originalRepayments, headroomPercentage);
        displayRepaymentSummaryWithHeadroom(originalRepayments, adjustedRepayments, headroomPercentage);
        
        console.log('');
        isHappyWithHeadroom = await confirmAction('Are you happy with this headroom percentage?');
        
        if (isHappyWithHeadroom) {
          finalRepayments = adjustedRepayments;
        }
      }
    }
    
    console.log('');
    const shouldUpdate = await confirmAction('Do you want to update the planned repayments in PocketSmith?');
    
    if (shouldUpdate) {
      // Find existing credit card repayment events
      const repaymentMonths = finalRepayments.map(r => r.repaymentMonth);
      const existingEvents = findCreditCardRepaymentEvents(allEvents, repaymentMonths);
      
      // Update the events
      await updateCreditCardRepaymentEvents(pocketSmithClient!, finalRepayments, existingEvents);
      
      console.log('');
      console.log('✅ Credit card repayment update process completed!');
    } else {
      console.log('');
      console.log('ℹ️  No changes made to PocketSmith. Calculation complete.');
    }

  } catch (error) {
    console.error('❌ Error updating repayments:', error);
    throw error;
  }
}

/**
 * Show the main menu and handle user choices
 */
async function showMainMenu(): Promise<void> {
  clearScreen();
  
  console.log('🚀 PocketSmith Tools - Credit Card Repayment Calculator');
  console.log('====================================================');
  console.log('');
  
  const choices = [
    '🔄 Fetch the data from PocketSmith',
    '📊 Show monthly breakdown',
    '💳 Update Credit Card Repayments in PocketSmith',
    '🚪 Exit'
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      pageSize: 10
    }
  ]);

  try {
    switch (action) {
      case choices[0]: // Fetch data
        await fetchDataFromPocketSmith();
        break;
      case choices[1]: // Show breakdown
        await showMonthlyBreakdown();
        break;
      case choices[2]: // Update repayments
        await updateCreditCardRepayments();
        break;
      case choices[3]: // Exit
        clearScreen();
        console.log('👋 Goodbye!');
        process.exit(0);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Wait for user to continue, then show menu again
  console.log('');
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }
  ]);

  // Show menu again
  await showMainMenu();
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Start the interactive menu
    await showMainMenu();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}
