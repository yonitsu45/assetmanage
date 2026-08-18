const { Router } = require('express');
const router = Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');
const { csrfCheck } = require('../middleware/csrf');

function handleProfileMulterError(req, res, next) {
  uploadProfile.single('profile_picture')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.redirect('/?profile_error=file_too_large');
      }
      return res.redirect('/?profile_error=invalid_file');
    }
    next();
  });
}

router.post('/profile/update', requireAuth, handleProfileMulterError, csrfCheck, profileController.update);

module.exports = router;
