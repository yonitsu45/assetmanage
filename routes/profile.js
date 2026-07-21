const { Router } = require('express');
const router = Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');

router.post('/profile/update', requireAuth, uploadProfile.single('profile_picture'), profileController.update);

module.exports = router;
