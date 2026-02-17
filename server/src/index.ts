import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDbAsync, closeDb } from './db/connection.js';
import { generateRecurringTransactions } from './services/recurringService.js';
import { fetchAllMarketData } from './services/marketDataService.js';

const PORT = Number(process.env.PORT) || 3002;

async function main() {
  await initializeDbAsync();

  // Generate any pending recurring transactions on startup
  try {
    const generated = await generateRecurringTransactions();
    if (generated > 0) {
      console.log(`Generated ${generated} recurring transactions`);
    }
  } catch (err) {
    console.error('Error generating recurring transactions:', err);
  }

  // Fetch market data on startup (non-blocking)
  fetchAllMarketData()
    .then(result => {
      if (result.mf > 0 || result.stocks > 0 || result.gold) {
        console.log(`Market data: ${result.mf} MF NAVs, ${result.stocks} stock prices, gold: ${result.gold}`);
      }
    })
    .catch(err => console.error('Error fetching market data:', err));

  // Set up recurring generation every 6 hours
  setInterval(async () => {
    try {
      const generated = await generateRecurringTransactions();
      if (generated > 0) {
        console.log(`Generated ${generated} recurring transactions`);
      }
    } catch (err) {
      console.error('Error generating recurring transactions:', err);
    }
  }, 6 * 60 * 60 * 1000);

  // Fetch market data daily
  setInterval(() => {
    fetchAllMarketData().catch(err => console.error('Error fetching market data:', err));
  }, 24 * 60 * 60 * 1000);

  const app = createApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Investments server running on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
