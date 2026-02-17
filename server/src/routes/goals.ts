import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { goalSchema, goalInvestmentSchema } from 'shared';
import * as goalService from '../services/goalService.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const goals = goalService.getAllGoals(req.session.userId);
  res.json(goals);
});

router.get('/:id', (req, res) => {
  const goal = goalService.getGoalById(Number(req.params.id));
  if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
  res.json(goal);
});

router.post('/', validate(goalSchema), (req, res) => {
  const goal = goalService.createGoal(req.session.userId!, req.body);
  res.status(201).json(goal);
});

router.put('/:id', (req, res) => {
  const goal = goalService.updateGoal(Number(req.params.id), req.body);
  if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
  res.json(goal);
});

router.delete('/:id', (req, res) => {
  const deleted = goalService.deleteGoal(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'Goal not found' }); return; }
  res.json({ ok: true });
});

router.post('/:id/investments', validate(goalInvestmentSchema), (req, res) => {
  try {
    goalService.assignInvestment(Number(req.params.id), req.body.investment_id, req.body.allocation_percent);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/investments/:investmentId', (req, res) => {
  goalService.removeInvestment(Number(req.params.id), Number(req.params.investmentId));
  res.json({ ok: true });
});

router.get('/:id/history', (req, res) => {
  try {
    const history = goalService.getGoalHistory(Number(req.params.id));
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/simulate', (req, res) => {
  try {
    const result = goalService.simulate(
      Number(req.params.id),
      req.body.monthly_sip_paise || 0,
      req.body.expected_return_percent || 12
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
