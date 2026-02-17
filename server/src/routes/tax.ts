import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { taxCalculateSchema } from 'shared';
import * as taxService from '../services/taxService.js';

const router = Router();
router.use(requireAuth);

router.post('/calculate', validate(taxCalculateSchema), (req, res) => {
  const summary = taxService.calculateCapitalGains(req.body.fy_start, req.body.fy_end, req.session.userId);
  res.json(summary);
});

router.get('/gains', (req, res) => {
  // Default to current FY (April to March)
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = `${year}-04-01`;
  const fyEnd = `${year + 1}-03-31`;
  const summary = taxService.calculateCapitalGains(fyStart, fyEnd, req.session.userId);
  res.json(summary);
});

export default router;
