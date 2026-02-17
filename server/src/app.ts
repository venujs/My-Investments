import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import investmentRoutes from './routes/investments.js';
import transactionRoutes from './routes/transactions.js';
import recurringRoutes from './routes/recurring.js';
import snapshotRoutes from './routes/snapshots.js';
import goalRoutes from './routes/goals.js';
import marketRoutes from './routes/market.js';
import taxRoutes from './routes/tax.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';
import importExportRoutes from './routes/importExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());

  // Session setup with SQLite store
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired INTEGER NOT NULL
    )
  `);
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)');
  } catch { /* index may already exist */ }

  const store = new SqliteSessionStore(db);

  app.use(session({
    store,
    secret: process.env.SESSION_SECRET || 'my-investments-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    },
  }));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/investments', investmentRoutes);
  app.use('/api', transactionRoutes);
  app.use('/api/recurring', recurringRoutes);
  app.use('/api/snapshots', snapshotRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/tax', taxRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api', importExportRoutes);

  // Serve static files in production
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res, next) => {
    if (_req.path.startsWith('/api')) { next(); return; }
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use(errorHandler);

  return app;
}

class SqliteSessionStore extends session.Store {
  private db: any;

  constructor(db: any) {
    super();
    this.db = db;
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  get(sid: string, callback: (err?: any, session?: session.SessionData | null) => void): void {
    try {
      const row = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?').get(sid, Date.now());
      if (row) {
        callback(null, JSON.parse(row.sess));
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge || 86400000;
      const expired = Date.now() + maxAge;
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      this.db.prepare(
        'INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)'
      ).run(sid, JSON.stringify(sessionData), expired);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  private cleanup(): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now());
    } catch { /* ignore */ }
  }
}
