import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';
import fs from 'fs';
import * as importService from '../services/importService.js';
import * as exportService from '../services/exportService.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();
router.use(requireAuth);

// Upload CSV and process import
router.post('/import/upload', upload.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  const investmentType = req.body.investment_type;
  if (!investmentType) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: 'investment_type is required' });
    return;
  }
  const content = fs.readFileSync(req.file.path, 'utf-8');
  fs.unlinkSync(req.file.path);
  try {
    const result = await importService.processImport(
      req.session.userId!,
      investmentType,
      content,
      req.file.originalname || 'import.csv'
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// Get CSV template
router.get('/export/template/:type', (req, res) => {
  const csv = importService.getTemplate(req.params.type);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}-template.csv`);
  res.send(csv);
});

// Export investments as CSV
router.get('/export/investments', (req, res) => {
  const type = req.query.type as string | undefined;
  const csv = exportService.exportInvestments(type, req.session.userId);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=investments.csv');
  res.send(csv);
});

// Export transactions as CSV
router.get('/export/transactions', (req, res) => {
  const investmentId = req.query.investment_id ? Number(req.query.investment_id) : undefined;
  const csv = exportService.exportTransactions(investmentId, req.session.userId);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
  res.send(csv);
});

export default router;
