import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { loginSchema, createUserSchema } from 'shared';
import * as userService from '../services/userService.js';

const router = Router();

router.get('/users', (_req, res) => {
  const users = userService.getAllUsers();
  res.json(users);
});

router.post('/login', validate(loginSchema), (req, res) => {
  const { userId, pin } = req.body;
  if (!userService.verifyPin(userId, pin)) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }
  req.session.userId = userId;
  const user = userService.getUserById(userId);
  res.json(user);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = userService.getUserById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

router.post('/setup', validate(createUserSchema), (req, res) => {
  const count = userService.getUserCount();
  if (count > 0) {
    res.status(400).json({ error: 'Setup already complete' });
    return;
  }
  const user = userService.createUser(req.body.name, req.body.pin, req.body.avatar, true);
  req.session.userId = user.id;
  res.json(user);
});

export default router;
