import { Router } from 'express';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
} from '../request-handlers/authController.js';
import { requireAuth } from '../request-filters/auth.js';
import { limitPerAddress } from '../request-filters/rateLimit.js';

const router = Router();

// Caps per network address on the routes anyone can reach. A whole class may register at once
// from one school network (which shares one address), so that cap is the loosest.
// Wrong passwords at sign-in have their own limit, inside the login handler.
const registerLimit = limitPerAddress({ max: 30, minutes: 15 });
const forgotLimit = limitPerAddress({ max: 10, minutes: 15 });
const resetLimit = limitPerAddress({ max: 10, minutes: 15 });
// Changing a password checks the current one, so without a cap someone holding a signed-in
// browser could guess the owner's password there, at 0.2 s of server work per guess
const passwordChangeLimit = limitPerAddress({ max: 10, minutes: 15 });

router.post('/register', registerLimit, register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/password', passwordChangeLimit, requireAuth, changePassword);
router.post('/forgot', forgotLimit, forgotPassword);
router.post('/reset', resetLimit, resetPassword);

export default router;
