import * as readline from 'readline';

/**
 * Prompt user for yes/no confirmation
 * @param question The question to ask the user
 * @returns Promise that resolves to true if user confirms, false otherwise
 */
export function confirmAction(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      const normalizedAnswer = answer.toLowerCase().trim();
      resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
    });
  });
}

/**
 * Prompt user for a percentage value
 * @param question The question to ask the user
 * @returns Promise that resolves to the percentage as a number (e.g., 20 for 20%)
 */
export function getPercentageInput(question: string): Promise<number> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question(`${question} `, (answer) => {
        const trimmed = answer.trim();
        
        // Remove % symbol if present
        const cleanAnswer = trimmed.replace('%', '');
        
        // Try to parse as number
        const percentage = parseFloat(cleanAnswer);
        
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          console.log('Please enter a valid percentage between 0 and 100 (e.g., 20 for 20%)');
          askQuestion();
        } else {
          rl.close();
          resolve(percentage);
        }
      });
    };

    askQuestion();
  });
}
