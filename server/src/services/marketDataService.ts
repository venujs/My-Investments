import { getDb } from '../db/connection.js';
import { today } from '../utils/date.js';
import { toPaise } from '../utils/inr.js';

// Wrapper around fetch() that aborts after timeoutMs milliseconds.
// Node.js fetch() has no built-in timeout; without this a hung API response
// (e.g. mfapi.in throttling silently) blocks the event loop forever.
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Resolve ISIN or legacy AMFI code to a numeric scheme code for mfapi.in
async function resolveSchemeCode(isinCode: string): Promise<string | null> {
  if (/^\d+$/.test(isinCode)) return isinCode; // already a numeric AMFI code
  try {
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(isinCode)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) return String(data[0].schemeCode);
  } catch { /* ignore */ }
  return null;
}

// Fetch MF NAV from mfapi.in (accepts ISIN or legacy AMFI/scheme code)
export async function fetchMFNav(isinCode: string): Promise<{ date: string; nav: number } | null> {
  try {
    const schemeCode = await resolveSchemeCode(isinCode);
    if (!schemeCode) return null;
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const latest = data.data[0];
      const nav = parseFloat(latest.nav);
      // mfapi date format: DD-MM-YYYY -> YYYY-MM-DD
      const parts = latest.date.split('-');
      const date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      return { date, nav };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching MF NAV for ${isinCode}:`, err);
    return null;
  }
}

// Fetch ISIN and details for a scheme code (for UI auto-fill)
export async function fetchSchemeDetails(schemeCode: string): Promise<{ isin: string; isin_reinvestment: string | null; scheme_name: string | null } | null> {
  try {
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      isin: data.meta?.isin_div_payout_or_growth || '',
      isin_reinvestment: data.meta?.isin_div_reinvestment || null,
      scheme_name: data.meta?.scheme_name || null,
    };
  } catch {
    return null;
  }
}

// Search MF schemes from mfapi.in
export async function searchMFSchemes(query: string): Promise<{ schemeCode: string; schemeName: string }[]> {
  try {
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 20).map((item: any) => ({
      schemeCode: String(item.schemeCode),
      schemeName: item.schemeName,
    }));
  } catch (err) {
    console.error(`Error searching MF schemes:`, err);
    return [];
  }
}

// Fetch stock price from Yahoo Finance
export async function fetchStockPrice(ticker: string, exchange: string): Promise<{ date: string; price: number } | null> {
  try {
    const symbol = exchange === 'BSE' ? `${ticker}.BO` : `${ticker}.NS`;
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const price = result.meta?.regularMarketPrice;
    if (!price) return null;
    return { date: today(), price };
  } catch (err) {
    console.error(`Error fetching stock price for ${ticker}:`, err);
    return null;
  }
}

// Fetch gold price (from Yahoo Finance - XAUUSD)
export async function fetchGoldPrice(): Promise<{ date: string; pricePerGramPaise: number } | null> {
  try {
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const priceUsdPerOz = result.meta?.regularMarketPrice;
    if (!priceUsdPerOz) return null;
    // Convert USD/oz -> INR/gram (approximate: 1 oz = 31.1035 grams, USD/INR ~ 84)
    const usdToInr = 84; // TODO: fetch live rate
    const pricePerGram = (priceUsdPerOz * usdToInr) / 31.1035;
    return { date: today(), pricePerGramPaise: toPaise(pricePerGram) };
  } catch (err) {
    console.error('Error fetching gold price:', err);
    return null;
  }
}

// Cache price in DB
export function cacheMarketPrice(symbol: string, source: string, date: string, pricePaise: number): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO market_prices (symbol, source, date, price_paise) VALUES (?, ?, ?, ?)`
  ).run(symbol, source, date, pricePaise);
}

export function cacheGoldPrice(date: string, pricePerGramPaise: number): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO gold_prices (date, price_per_gram_paise) VALUES (?, ?)`
  ).run(date, pricePerGramPaise);
}

// Fetch and cache all market data
export async function fetchAllMarketData(): Promise<{ mf: number; stocks: number; gold: boolean }> {
  const db = getDb();
  let mfCount = 0;
  let stockCount = 0;
  let goldFetched = false;

  // Fetch MF NAVs for all active MF investments
  const mfInvestments = db.prepare(
    `SELECT DISTINCT m.isin_code, m.scheme_code FROM investment_mf m JOIN investments i ON m.investment_id = i.id WHERE i.is_active = 1`
  ).all() as { isin_code: string; scheme_code: string | null }[];

  for (const { isin_code, scheme_code } of mfInvestments) {
    const identifier = scheme_code || isin_code;
    const nav = await fetchMFNav(identifier);
    if (nav) {
      cacheMarketPrice(identifier, 'mfapi', nav.date, toPaise(nav.nav));
      mfCount++;
    }
  }

  // Fetch stock prices for all active share investments
  const shareInvestments = db.prepare(
    `SELECT DISTINCT s.ticker_symbol, s.exchange FROM investment_shares s JOIN investments i ON s.investment_id = i.id WHERE i.is_active = 1`
  ).all() as { ticker_symbol: string; exchange: string }[];

  for (const { ticker_symbol, exchange } of shareInvestments) {
    const price = await fetchStockPrice(ticker_symbol, exchange);
    if (price) {
      cacheMarketPrice(ticker_symbol, 'yahoo', price.date, toPaise(price.price));
      stockCount++;
    }
  }

  // Fetch gold price
  const gold = await fetchGoldPrice();
  if (gold) {
    cacheGoldPrice(gold.date, gold.pricePerGramPaise);
    goldFetched = true;
  }

  return { mf: mfCount, stocks: stockCount, gold: goldFetched };
}

// Get cached price
export function getCachedPrice(symbol: string, source: string): { date: string; price_paise: number } | undefined {
  const db = getDb();
  return db.prepare(
    `SELECT date, price_paise FROM market_prices WHERE symbol = ? AND source = ? ORDER BY date DESC LIMIT 1`
  ).get(symbol, source) as { date: string; price_paise: number } | undefined;
}

// Fetch historical stock prices (1 year) from Yahoo Finance
export async function fetchStockHistory(ticker: string, exchange: string): Promise<{ date: string; price_paise: number }[]> {
  try {
    const symbol = exchange === 'BSE' ? `${ticker}.BO` : `${ticker}.NS`;
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`);
    if (!res.ok) return [];
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const history: { date: string; price_paise: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        const d = new Date(timestamps[i] * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        history.push({ date: dateStr, price_paise: toPaise(closes[i]) });
      }
    }
    return history;
  } catch (err) {
    console.error(`Error fetching stock history for ${ticker}:`, err);
    return [];
  }
}

// Get price history from DB
export function getPriceHistory(symbol: string): { date: string; price_paise: number }[] {
  const db = getDb();
  return db.prepare(
    `SELECT date, price_paise FROM market_prices WHERE symbol = ? ORDER BY date ASC`
  ).all(symbol) as { date: string; price_paise: number }[];
}

export function setManualPrice(symbol: string, date: string, pricePaise: number): void {
  cacheMarketPrice(symbol, 'manual', date, pricePaise);
}

// Get cached price for a specific date (closest date <= target)
export function getCachedPriceForDate(symbol: string, source: string | string[], targetDate: string): { date: string; price_paise: number } | undefined {
  const db = getDb();
  const sources = Array.isArray(source) ? source : [source];
  const placeholders = sources.map(() => '?').join(',');
  return db.prepare(
    `SELECT date, price_paise FROM market_prices WHERE symbol = ? AND source IN (${placeholders}) AND date <= ? ORDER BY date DESC LIMIT 1`
  ).get(symbol, ...sources, targetDate) as { date: string; price_paise: number } | undefined;
}

// Fetch full MF NAV history from mfapi.in and cache all entries
export async function fetchMFNavHistory(isinCode: string): Promise<{ date: string; nav: number }[]> {
  try {
    const schemeCode = await resolveSchemeCode(isinCode);
    if (!schemeCode) return [];
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];
    const results: { date: string; nav: number }[] = [];
    for (const entry of data.data) {
      const nav = parseFloat(entry.nav);
      if (isNaN(nav)) continue;
      // mfapi date format: DD-MM-YYYY -> YYYY-MM-DD
      const parts = entry.date.split('-');
      const date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      results.push({ date, nav });
    }
    // Batch-insert all entries in a single transaction to avoid blocking the event loop
    if (results.length > 0) {
      const db = getDb();
      const insertStmt = db.prepare(
        `INSERT OR REPLACE INTO market_prices (symbol, source, date, price_paise) VALUES (?, ?, ?, ?)`
      );
      db.transaction(() => {
        for (const { date, nav } of results) {
          insertStmt.run(isinCode, 'mfapi', date, Math.round(nav * 100));
        }
      })();
    }
    return results;
  } catch (err) {
    console.error(`Error fetching MF NAV history for ${isinCode}:`, err);
    return [];
  }
}

// Get MF NAV for a specific date (cache first, then API fallback)
export async function fetchMFNavForDate(isinCode: string, targetDate: string): Promise<{ date: string; pricePaise: number } | null> {
  const db = getDb();

  // Check cache first
  const cached = getCachedPriceForDate(isinCode, 'mfapi', targetDate);
  if (cached) return { date: cached.date, pricePaise: cached.price_paise };

  // If we already have ANY data for this fund, don't re-download.
  // The targetDate is simply before the earliest available entry — return earliest.
  const hasAny = db.prepare(
    `SELECT date, price_paise FROM market_prices WHERE symbol = ? AND source = 'mfapi' ORDER BY date ASC LIMIT 1`
  ).get(isinCode) as { date: string; price_paise: number } | undefined;
  if (hasAny) {
    return { date: hasAny.date, pricePaise: hasAny.price_paise };
  }

  // No data at all — fetch full history and cache
  const history = await fetchMFNavHistory(isinCode);
  if (history.length === 0) {
    // Fallback to latest
    const latest = await fetchMFNav(isinCode);
    if (latest) {
      const pricePaise = Math.round(latest.nav * 100);
      cacheMarketPrice(isinCode, 'mfapi', latest.date, pricePaise);
      return { date: latest.date, pricePaise };
    }
    return null;
  }

  // Look up from cache again after populating
  const cachedAfter = getCachedPriceForDate(isinCode, 'mfapi', targetDate);
  if (cachedAfter) return { date: cachedAfter.date, pricePaise: cachedAfter.price_paise };

  // If target date is before all available history, use earliest
  const earliest = history[history.length - 1]; // history is newest-first from API
  const pricePaise = Math.round(earliest.nav * 100);
  return { date: earliest.date, pricePaise };
}

// Get stock price for a specific date (cache first, then API fallback)
export async function fetchStockPriceForDate(ticker: string, exchange: string, targetDate: string): Promise<{ date: string; pricePaise: number } | null> {
  const db = getDb();

  // Check cache first
  const cached = getCachedPriceForDate(ticker, ['yahoo', 'manual'], targetDate);
  if (cached) return { date: cached.date, pricePaise: cached.price_paise };

  // If we already have ANY data for this ticker, don't re-download.
  // Yahoo Finance only provides 1yr history, so dates older than that won't appear — return earliest.
  const hasAny = db.prepare(
    `SELECT date, price_paise FROM market_prices WHERE symbol = ? AND source = 'yahoo' ORDER BY date ASC LIMIT 1`
  ).get(ticker) as { date: string; price_paise: number } | undefined;
  if (hasAny) {
    return { date: hasAny.date, pricePaise: hasAny.price_paise };
  }

  // No data at all — fetch 1yr history and batch-insert in a single transaction
  const history = await fetchStockHistory(ticker, exchange);
  if (history.length > 0) {
    const insertStmt = db.prepare(
      `INSERT OR REPLACE INTO market_prices (symbol, source, date, price_paise) VALUES (?, ?, ?, ?)`
    );
    db.transaction(() => {
      for (const h of history) {
        insertStmt.run(ticker, 'yahoo', h.date, h.price_paise);
      }
    })();
  }

  // Look up again after caching
  if (history.length > 0) {
    const cachedAfter = getCachedPriceForDate(ticker, ['yahoo', 'manual'], targetDate);
    if (cachedAfter) return { date: cachedAfter.date, pricePaise: cachedAfter.price_paise };
    // Use earliest available
    const earliest = history[0];
    return { date: earliest.date, pricePaise: earliest.price_paise };
  }

  // Fallback to current price
  const current = await fetchStockPrice(ticker, exchange);
  if (current) {
    const pricePaise = toPaise(current.price);
    cacheMarketPrice(ticker, 'yahoo', current.date, pricePaise);
    return { date: current.date, pricePaise };
  }

  return null;
}

export function getCachedGoldPriceForDate(targetDate: string): { date: string; price_per_gram_paise: number } | undefined {
  const db = getDb();
  return db.prepare(
    `SELECT date, price_per_gram_paise FROM gold_prices WHERE date <= ? ORDER BY date DESC LIMIT 1`
  ).get(targetDate) as { date: string; price_per_gram_paise: number } | undefined;
}

export function getCachedGoldPrice(): { date: string; price_per_gram_paise: number } | undefined {
  const db = getDb();
  return db.prepare(
    `SELECT date, price_per_gram_paise FROM gold_prices ORDER BY date DESC LIMIT 1`
  ).get() as { date: string; price_per_gram_paise: number } | undefined;
}
