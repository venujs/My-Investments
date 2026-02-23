import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createInvestmentWithDetailSchema, updateInvestmentSchema, overrideSchema } from 'shared';
import * as investmentService from '../services/investmentService.js';
import * as valuationService from '../services/valuationService.js';
import * as transactionService from '../services/transactionService.js';
import * as recurringService from '../services/recurringService.js';
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
