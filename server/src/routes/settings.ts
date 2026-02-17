import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';

const router = Router();
router.use(requireAuth);

const TYPE_RATE_KEYS = [
  'rate_fd', 'rate_rd', 'rate_mf_equity', 'rate_mf_hybrid', 'rate_mf_debt',
  'rate_shares', 'rate_gold', 'rate_loan', 'rate_fixed_asset', 'rate_pension', 'rate_savings_account',
];

const DEFAULT_RATES: Record<string, number> = {
  rate_fd: 7,
  rate_rd: 7,
  rate_mf_equity: 12,
  rate_mf_hybrid: 10,
  rate_mf_debt: 7,
  rate_shares: 12,
  rate_gold: 8,
  rate_loan: 9,
  rate_fixed_asset: 6,
  rate_pension: 8,
  rate_savings_account: 4,
};

router.get('/type-rates', (_req, res) => {
  const db = getDb();
  const rates: Record<string, number> = { ...DEFAULT_RATES };
  for (const key of TYPE_RATE_KEYS) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) rates[key] = parseFloat(row.value);
  }
  res.json(rates);
});

router.put('/type-rates', (req, res) => {
  const db = getDb();
  const rates = req.body as Record<string, number>;
  for (const [key, value] of Object.entries(rates)) {
    if (TYPE_RATE_KEYS.includes(key) && typeof value === 'number') {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    }
  }
  res.json({ ok: true });
});

export default router;
