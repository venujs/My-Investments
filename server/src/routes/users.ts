import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, changePinSchema } from 'shared';
import * as userService from '../services/userService.js';

const router = Router();
router.use(requireAuth);

router.get('/', (_req, res) => {
  res.json(userService.getAllUsers());
});

router.get('/:id', (req, res) => {
  const user = userService.getUserById(Number(req.params.id));
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

router.post('/', validate(createUserSchema), (req, res) => {
  if (!userService.isAdmin(req.session.userId!)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const user = userService.createUser(req.body.name, req.body.pin, req.body.avatar, req.body.is_admin);
  res.status(201).json(user);
});

router.put('/:id', validate(updateUserSchema), (req, res) => {
  if (!userService.isAdmin(req.session.userId!) && req.session.userId !== Number(req.params.id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const user = userService.updateUser(Number(req.params.id), req.body);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

router.post('/:id/change-pin', validate(changePinSchema), (req, res) => {
  const userId = Number(req.params.id);
  if (req.session.userId !== userId && !userService.isAdmin(req.session.userId!)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (req.session.userId === userId) {
    if (!userService.verifyPin(userId, req.body.currentPin)) {
      res.status(400).json({ error: 'Current PIN is incorrect' });
      return;
    }
  }
  userService.changePin(userId, req.body.newPin);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  if (!userService.isAdmin(req.session.userId!)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  if (req.session.userId === Number(req.params.id)) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }
  const deleted = userService.deleteUser(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ ok: true });
});

export default router;
