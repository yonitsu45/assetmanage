const { Router } = require('express');
const router = Router();
const authController = require('../controllers/authController');
const { redirectIfAuth } = require('../middleware/auth');

router.get('/login', redirectIfAuth, authController.showLogin);
router.post('/login', redirectIfAuth, authController.login);
router.get('/register', redirectIfAuth, authController.showRegister);
router.post('/register', redirectIfAuth, authController.register);
router.post('/logout', authController.logout);

module.exports = router;
