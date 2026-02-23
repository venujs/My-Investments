import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as marketDataService from '../services/marketDataService.js';

const router = Router();
router.use(requireAuth);

router.post('/fetch', async (_req, res) => {
  try {
    const result = await marketDataService.fetchAllMarketData();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/price/:symbol', (req, res) => {
  const source = (req.query.source as string) || 'mfapi';
  const price = marketDataService.getCachedPrice(req.params.symbol, source);
  if (!price) { res.status(404).json({ error: 'Price not found' }); return; }
  res.json(price);
});

router.get('/gold', (_req, res) => {
  const price = marketDataService.getCachedGoldPrice();
  if (!price) { res.status(404).json({ error: 'Gold price not found' }); return; }
  res.json(price);
});

router.get('/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const exchange = (req.query.exchange as string) || 'NSE';
  // Try to fetch fresh history from Yahoo
  const history = await marketDataService.fetchStockHistory(symbol, exchange);
  if (history.length > 0) {
    // Cache the data
    for (const h of history) {
      marketDataService.cacheMarketPrice(symbol, 'yahoo', h.date, h.price_paise);
    }
    res.json(history);
  } else {
    // Fallback to cached data
    const cached = marketDataService.getPriceHistory(symbol);
    res.json(cached);
  }
});

router.post('/price', (req, res) => {
  const { symbol, date, price_paise } = req.body;
  if (!symbol || !date || !price_paise) { res.status(400).json({ error: 'symbol, date, and price_paise required' }); return; }
  marketDataService.setManualPrice(symbol, date, price_paise);
  res.json({ ok: true });
});

router.post('/fetch-mf/:isinCode', async (req, res) => {
  try {
    const { isinCode } = req.params;
    const nav = await marketDataService.fetchMFNav(isinCode);
    if (!nav) { res.status(404).json({ error: 'Could not fetch NAV' }); return; }
    const { toPaise } = await import('../utils/inr.js');
    marketDataService.cacheMarketPrice(isinCode, 'mfapi', nav.date, toPaise(nav.nav));
    res.json({ date: nav.date, nav: nav.nav, price_paise: toPaise(nav.nav) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mf/scheme/:schemeCode', async (req, res) => {
  try {
    const details = await marketDataService.fetchSchemeDetails(req.params.schemeCode);
    if (!details) { res.status(404).json({ error: 'Scheme not found' }); return; }
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mf/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'Query parameter q is required' }); return; }
  const results = await marketDataService.searchMFSchemes(q);
  res.json(results);
});

export default router;
