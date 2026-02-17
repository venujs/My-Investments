import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as snapshotService from '../services/snapshotService.js';
import * as valuationService from '../services/valuationService.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', (req, res) => {
  const stats = snapshotService.getDashboardStats(req.session.userId);
  res.json(stats);
});

router.get('/net-worth-chart', (req, res) => {
  const history = snapshotService.getNetWorthHistory(req.session.userId!);
  res.json(history);
});

router.get('/breakdown', (req, res) => {
  const breakdown = snapshotService.getInvestmentBreakdown(req.session.userId);
  res.json(breakdown);
});

router.get('/type-xirr/:type', (req, res) => {
  const xirr = valuationService.calculateTypeXIRR(req.params.type, req.session.userId);
  res.json({ xirr });
});

router.get('/type-history/:type', (req, res) => {
  const history = snapshotService.getTypeHistory(req.session.userId!, req.params.type);
  res.json(history);
});

export default router;
