import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as snapshotService from '../services/snapshotService.js';

const router = Router();
router.use(requireAuth);

router.post('/calculate', (req, res) => {
  const count = snapshotService.calculateMonthlySnapshots(req.body.year_month);
  snapshotService.calculateNetWorthSnapshot(req.session.userId!, req.body.year_month);
  res.json({ snapshots_calculated: count });
});

router.get('/net-worth', (req, res) => {
  const history = snapshotService.getNetWorthHistory(req.session.userId!);
  res.json(history);
});

router.post('/generate-historical', async (req, res) => {
  try {
    const count = await snapshotService.generateHistoricalSnapshots(req.session.userId!);
    res.json({ months_processed: count });
  } catch (err: any) {
    console.error('Error generating historical snapshots:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', (req, res) => {
  const list = snapshotService.getSnapshotList(req.session.userId!);
  res.json(list);
});

router.get('/detail/:yearMonth', (req, res) => {
  const detail = snapshotService.getSnapshotDetail(req.session.userId!, req.params.yearMonth);
  res.json(detail);
});

router.post('/clear', (_req, res) => {
  snapshotService.clearSnapshots();
  res.json({ ok: true });
});

export default router;
