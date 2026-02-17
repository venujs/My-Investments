import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recurringRuleSchema } from 'shared';
import * as recurringService from '../services/recurringService.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rules = recurringService.getAllRules(req.session.userId);
  res.json(rules);
});

router.get('/:id', (req, res) => {
  const rule = recurringService.getRuleById(Number(req.params.id));
  if (!rule) { res.status(404).json({ error: 'Rule not found' }); return; }
  res.json(rule);
});

router.post('/', validate(recurringRuleSchema), async (req, res) => {
  try {
    const rule = await recurringService.createRule(req.session.userId!, req.body);
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const rule = recurringService.updateRule(Number(req.params.id), req.body);
  if (!rule) { res.status(404).json({ error: 'Rule not found' }); return; }
  res.json(rule);
});

router.delete('/:id', (req, res) => {
  const deleted = recurringService.deleteRule(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'Rule not found' }); return; }
  res.json({ ok: true });
});

router.post('/generate', async (_req, res) => {
  const count = await recurringService.generateRecurringTransactions();
  res.json({ generated: count });
});

export default router;
