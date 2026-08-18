const { Router } = require('express');
const router = Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/upload');

function handleMulterError(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.render('upload', { result: null, error: 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10 MB)', isWarning: false });
      }
      return res.render('upload', { result: null, error: err.message || 'ไฟล์ไม่ถูกต้อง', isWarning: false });
    }
    next();
  });
}

router.get('/', uploadController.showUpload);
router.post('/file', handleMulterError, uploadController.handleUpload);
router.post('/manual', uploadController.handleManualEntry);

module.exports = router;
