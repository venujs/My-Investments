import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { investmentTxnSchema, sellSchema } from 'shared';
import * as transactionService from '../services/transactionService.js';
import * as investmentService from '../services/investmentService.js';

const router = Router();
router.use(requireAuth);

// Clear all transactions
router.post('/transactions/clear-all', (req, res) => {
  const count = transactionService.deleteAllTransactions(req.session.userId);
  res.json({ deleted: count });
});

// Get transactions for an investment
router.get('/investments/:id/transactions', (req, res) => {
  const txns = transactionService.getTransactions(Number(req.params.id));
  res.json(txns);
});

// Get all transactions
router.get('/', (req, res) => {
  const txns = transactionService.getAllTransactions(req.session.userId);
  res.json(txns);
});

// Create transaction
router.post('/investments/:id/transactions', validate(investmentTxnSchema), (req, res) => {
  const investmentId = Number(req.params.id);
  const weightGrams = req.body.weight_grams ? parseFloat(req.body.weight_grams) : null;

  // If gold weight provided, store it in notes for reversibility
  const txnData = { ...req.body };
  if (weightGrams && weightGrams > 0) {
    const ppg = req.body.price_per_gram_paise || 0;
    const weightNote = `weight:${weightGrams}|ppg:${ppg}`;
    txnData.notes = txnData.notes ? `${weightNote} | ${txnData.notes}` : weightNote;
  }
  delete txnData.weight_grams;
  delete txnData.price_per_gram_paise;

  const txn = transactionService.createTransaction(investmentId, req.session.userId!, txnData);

  // Update gold weight if applicable
  if (weightGrams && weightGrams > 0) {
    const inv = investmentService.getInvestmentById(investmentId);
    if (inv && inv.investment_type === 'gold') {
      const delta = ['buy', 'sip', 'deposit'].includes(req.body.txn_type) ? weightGrams : -weightGrams;
      investmentService.updateGoldWeight(investmentId, delta);
    }
  }

  res.status(201).json(txn);
});

// FIFO sell
router.post('/investments/:id/sell', validate(sellSchema), (req, res) => {
  try {
    const result = transactionService.executeSell(
      Number(req.params.id),
      req.session.userId!,
      req.body.date,
      req.body.units,
      req.body.price_per_unit_paise,
      req.body.fees_paise || 0,
      req.body.notes
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get lots for an investment
router.get('/investments/:id/lots', (req, res) => {
  const lots = transactionService.getLots(Number(req.params.id));
  res.json(lots);
});

// Update transaction
router.put('/transactions/:id', (req, res) => {
  const updated = transactionService.updateTransaction(Number(req.params.id), req.body);
  if (!updated) { res.status(404).json({ error: 'Transaction not found' }); return; }
  res.json(updated);
});

// Delete transaction
router.delete('/transactions/:id', (req, res) => {
  const txnId = Number(req.params.id);
  // Check if this is a gold transaction with weight info before deleting
  const txn = transactionService.getTransactionById(txnId);
  if (txn && txn.notes) {
    const weightMatch = txn.notes.match(/weight:([\d.]+)/);
    if (weightMatch) {
      const weightGrams = parseFloat(weightMatch[1]);
      const inv = investmentService.getInvestmentById(txn.investment_id);
      if (inv && inv.investment_type === 'gold' && weightGrams > 0) {
        // Reverse the weight change
        const delta = ['buy', 'sip', 'deposit'].includes(txn.txn_type) ? -weightGrams : weightGrams;
        investmentService.updateGoldWeight(txn.investment_id, delta);
      }
    }
  }
  const deleted = transactionService.deleteTransaction(txnId);
  if (!deleted) { res.status(404).json({ error: 'Transaction not found' }); return; }
  res.json({ ok: true });
});

export default router;
