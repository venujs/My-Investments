import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as snapshotService from '../services/snapshotService.js';

const router = Router();
router.use(requireAuth);

// In-memory job status per userId — survives until next run
interface JobStatus {
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  monthsProcessed?: number;
  error?: string;
}
const jobStatus = new Map<number, JobStatus>();

router.post('/calculate', (req, res) => {
  const count = snapshotService.calculateMonthlySnapshots(req.body.year_month);
  snapshotService.calculateNetWorthSnapshot(req.session.userId!, req.body.year_month);
  res.json({ snapshots_calculated: count });
});

router.get('/net-worth', (req, res) => {
  const history = snapshotService.getNetWorthHistory(req.session.userId!);
  res.json(history);
});

router.post('/generate-historical', (req, res) => {
  const userId = req.session.userId!;

  // Prevent concurrent runs for the same user
  const current = jobStatus.get(userId);
  if (current?.status === 'running') {
    res.status(409).json({ error: 'already_running', message: 'A snapshot generation job is already in progress.' });
    return;
  }

  const startedAt = new Date().toISOString();
  jobStatus.set(userId, { status: 'running', startedAt });
  res.json({ started: true });
  snapshotService.generateHistoricalSnapshots(userId)
    .then(count => {
      jobStatus.set(userId, { status: 'completed', startedAt, completedAt: new Date().toISOString(), monthsProcessed: count });
      console.log(`Historical snapshots: ${count} months processed for user ${userId}`);
    })
    .catch(err => {
      const message = err instanceof Error ? err.message : String(err);
      jobStatus.set(userId, { status: 'failed', startedAt, completedAt: new Date().toISOString(), error: message });
      console.error(`Historical snapshots failed for user ${userId}:`, err);
    });
});

router.get('/job-status', (req, res) => {
  const status = jobStatus.get(req.session.userId!) ?? null;
  res.json(status);
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
