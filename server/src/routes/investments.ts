import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createInvestmentWithDetailSchema, updateInvestmentSchema, overrideSchema } from 'shared';
import * as investmentService from '../services/investmentService.js';
import * as valuationService from '../services/valuationService.js';
import * as transactionService from '../services/transactionService.js';
import * as recurringService from '../services/recurringService.js';
import { getDb } from '../db/connection.js';
import { today } from '../utils/date.js';

const router = Router();
router.use(requireAuth);

// Clear all investments
router.post('/clear-all', (req, res) => {
  const count = investmentService.deleteAllInvestments(req.session.userId);
  res.json({ deleted: count });
});

// Clear all investments of a specific type (use 'mf' to clear all three MF subtypes)
router.post('/clear-by-type/:type', (req, res) => {
  const { type } = req.params;
  const userId = req.session.userId!;
  const types = type === 'mf' ? ['mf_equity', 'mf_hybrid', 'mf_debt'] : [type];
  let deleted = 0;
  for (const t of types) {
    deleted += investmentService.deleteAllInvestmentsByType(userId, t);
  }
  res.json({ deleted });
});

// Get all investments
router.get('/', (req, res) => {
  const investments = investmentService.getAllInvestments();
  const enriched = investments.map(inv => valuationService.enrichInvestment(inv));
  res.json(enriched);
});

// Get investments by type
router.get('/by-type/:type', (req, res) => {
  const investments = investmentService.getInvestmentsByType(req.params.type);
  const enriched = investments.map(inv => valuationService.enrichInvestment(inv));
  res.json(enriched);
});

// Get single investment
router.get('/:id', (req, res) => {
  const inv = investmentService.getInvestmentById(Number(req.params.id));
  if (!inv) { res.status(404).json({ error: 'Investment not found' }); return; }
  res.json(valuationService.enrichInvestment(inv));
});

// Create investment with detail
router.post('/', validate(createInvestmentWithDetailSchema), async (req, res) => {
  const { investment, detail } = req.body;
  const created = investmentService.createInvestment(req.session.userId!, investment, detail);

  // Auto-create initial buy transaction for gold investments
  if (investment.investment_type === 'gold' && detail.weight_grams > 0 && detail.purchase_price_per_gram_paise > 0) {
    const amountPaise = Math.round(detail.weight_grams * detail.purchase_price_per_gram_paise);
    transactionService.createTransaction(created.id, req.session.userId!, {
      txn_type: 'buy',
      date: detail.purchase_date || today(),
      amount_paise: amountPaise,
      notes: `Initial purchase | weight:${detail.weight_grams}|ppg:${detail.purchase_price_per_gram_paise}`,
    });
  }

  // Auto-create recurring rule for RD investments
  if (investment.investment_type === 'rd' && detail.monthly_installment_paise > 0 && detail.start_date) {
    const dayOfMonth = new Date(detail.start_date + 'T00:00:00').getDate();
    await recurringService.createRule(req.session.userId!, {
      investment_id: created.id,
      txn_type: 'deposit',
      amount_paise: detail.monthly_installment_paise,
      frequency: 'monthly',
      start_date: detail.start_date,
      end_date: detail.maturity_date || null,
      day_of_month: dayOfMonth,
    });
  }

  res.status(201).json(valuationService.enrichInvestment(created));
});

// Set balance for savings_account and pension (auto-creates deposit/withdrawal to reconcile)
router.post('/:id/set-balance', (req, res) => {
  const { balance_paise, date } = req.body as { balance_paise: number; date?: string };
  if (typeof balance_paise !== 'number' || balance_paise < 0) {
    res.status(400).json({ error: 'balance_paise required and must be >= 0' }); return;
  }
  const id = Number(req.params.id);
  const inv = investmentService.getInvestmentById(id);
  if (!inv || !['savings_account', 'pension'].includes(inv.investment_type)) {
    res.status(404).json({ error: 'Not found' }); return;
  }
  const currentBalance = valuationService.enrichInvestment(inv).current_value_paise || 0;
  const delta = balance_paise - currentBalance;
  if (Math.abs(delta) >= 1) {
    transactionService.createTransaction(id, req.session.userId!, {
      txn_type: delta > 0 ? 'deposit' : 'withdrawal',
      date: date || today(),
      amount_paise: Math.abs(Math.round(delta)),
      notes: 'Balance adjustment',
    });
  }
  const updated = investmentService.getInvestmentById(id)!;
  res.json(valuationService.enrichInvestment(updated));
});

// Close FD/RD early (sets closure date as maturity_date with reduced rate)
router.post('/:id/close-early', (req, res) => {
  const { closure_date, interest_rate } = req.body as { closure_date: string; interest_rate: number };
  if (!closure_date || typeof interest_rate !== 'number') {
    res.status(400).json({ error: 'closure_date and interest_rate are required' }); return;
  }
  const id = Number(req.params.id);
  const db = getDb();

  const inv = db.prepare(
    'SELECT investment_type FROM investments WHERE id = ? AND user_id = ?'
  ).get(id, req.session.userId!) as { investment_type: string } | undefined;

  if (!inv || (inv.investment_type !== 'fd' && inv.investment_type !== 'rd')) {
    res.status(404).json({ error: 'FD or RD not found' }); return;
  }

  const updated = investmentService.updateInvestment(id, {}, {
    maturity_date: closure_date,
    interest_rate,
    is_closed_early: 1,
  });
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }

  // For RD: deactivate the recurring deposit rule
  if (inv.investment_type === 'rd') {
    const rule = db.prepare(
      'SELECT id FROM recurring_rules WHERE investment_id = ? AND is_active = 1 LIMIT 1'
    ).get(id) as { id: number } | undefined;
    if (rule) recurringService.updateRule(rule.id, { end_date: closure_date, is_active: false });
  }

  res.json(valuationService.enrichInvestment(updated));
});

// Update investment
router.put('/:id', (req, res) => {
  const { investment, detail } = req.body;
  const updated = investmentService.updateInvestment(Number(req.params.id), investment || {}, detail);
  if (!updated) { res.status(404).json({ error: 'Investment not found' }); return; }
  res.json(valuationService.enrichInvestment(updated));
});

// Delete investment
router.delete('/:id', (req, res) => {
  const deleted = investmentService.deleteInvestment(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'Investment not found' }); return; }
  res.json({ ok: true });
});

// Add value override
router.post('/:id/override', validate(overrideSchema), (req, res) => {
  const inv = investmentService.getInvestmentById(Number(req.params.id));
  if (!inv) { res.status(404).json({ error: 'Investment not found' }); return; }
  investmentService.addOverride(inv.id, req.session.userId!, req.body.override_date, req.body.value_paise, req.body.reason);
  res.json({ ok: true });
});

// Get overrides
router.get('/:id/overrides', (req, res) => {
  const overrides = investmentService.getOverrides(Number(req.params.id));
  res.json(overrides);
});

export default router;
