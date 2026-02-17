import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';
import type { User } from 'shared';

export function getAllUsers(): Omit<User, 'pin_hash'>[] {
  const db = getDb();
  return db.prepare('SELECT id, name, avatar, is_admin, created_at FROM users').all() as User[];
}

export function getUserById(id: number): User | undefined {
  const db = getDb();
  return db.prepare('SELECT id, name, avatar, is_admin, created_at FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(name: string, pin: string, avatar: string | null = null, isAdmin: boolean = false): User {
  const db = getDb();
  const pinHash = bcrypt.hashSync(pin, 10);
  const result = db.prepare(
    'INSERT INTO users (name, pin_hash, avatar, is_admin) VALUES (?, ?, ?, ?)'
  ).run(name, pinHash, avatar, isAdmin ? 1 : 0);
  return getUserById(Number(result.lastInsertRowid))!;
}

export function verifyPin(userId: number, pin: string): boolean {
  const db = getDb();
  const user = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(userId) as { pin_hash: string } | undefined;
  if (!user) return false;
  return bcrypt.compareSync(pin, user.pin_hash);
}

export function updateUser(id: number, data: { name?: string; avatar?: string | null; is_admin?: boolean }): User | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.avatar !== undefined) { fields.push('avatar = ?'); values.push(data.avatar); }
  if (data.is_admin !== undefined) { fields.push('is_admin = ?'); values.push(data.is_admin ? 1 : 0); }
  if (fields.length === 0) return getUserById(id);
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getUserById(id);
}

export function changePin(userId: number, newPin: string): void {
  const db = getDb();
  const pinHash = bcrypt.hashSync(newPin, 10);
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, userId);
}

export function deleteUser(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getUserCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count;
}

export function isAdmin(userId: number): boolean {
  const db = getDb();
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as { is_admin: number } | undefined;
  return user?.is_admin === 1;
}
