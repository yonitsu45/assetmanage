const { Router } = require('express');
const router = Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const authController = require('../controllers/authController');
const { redirectIfAuth } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip) + '_login'
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip) + '_register'
});

router.get('/login', redirectIfAuth, authController.showLogin);
router.post('/login', redirectIfAuth, loginLimiter, authController.login);
router.get('/register', redirectIfAuth, authController.showRegister);
router.post('/register', redirectIfAuth, registerLimiter, authController.register);
router.post('/logout', authController.logout);

module.exports = router;
