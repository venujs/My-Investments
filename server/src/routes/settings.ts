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

// Nuclear option: wipe ALL user-created data across every table.
// Keeps users and settings rows intact so login still works.
router.post('/purge-all-data', (req, res) => {
  const db = getDb();
  db.transaction(() => {
    // Delete in dependency order (FK enforcement may be off, but safest order regardless)
    db.prepare('DELETE FROM lot_sell_allocations').run();
    db.prepare('DELETE FROM investment_lots').run();
    db.prepare('DELETE FROM investment_transactions').run();
    db.prepare('DELETE FROM investment_overrides').run();
    db.prepare('DELETE FROM monthly_snapshots').run();
    db.prepare('DELETE FROM goal_investments').run();
    db.prepare('DELETE FROM goals').run();
    db.prepare('DELETE FROM net_worth_snapshots').run();
    db.prepare('DELETE FROM recurring_rules').run();
    db.prepare('DELETE FROM import_batches').run();
    db.prepare('DELETE FROM investment_fd').run();
    db.prepare('DELETE FROM investment_rd').run();
    db.prepare('DELETE FROM investment_mf').run();
    db.prepare('DELETE FROM investment_shares').run();
    db.prepare('DELETE FROM investment_gold').run();
    db.prepare('DELETE FROM investment_loan').run();
    db.prepare('DELETE FROM investment_fixed_asset').run();
    db.prepare('DELETE FROM investment_pension').run();
    db.prepare('DELETE FROM investment_savings_account').run();
    db.prepare('DELETE FROM investments').run();
    db.prepare('DELETE FROM market_prices').run();
    db.prepare('DELETE FROM gold_prices').run();
  })();
  console.log(`[PURGE] All data wiped by user ${req.session.userId}`);
  res.json({ ok: true });
});

export default router;
