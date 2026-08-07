const { Router } = require('express');
const router = Router();
const documentController = require('../controllers/documentController');
const { uploadPdf } = require('../middleware/upload');
const fs = require('fs');

function renderUploadError(req, res, message) {
  return documentController.renderIndex(req, res, { error: message }).catch(err => {
    console.error('Document upload error render:', err);
    res.status(500).send('Server error');
  });
}

router.get('/', documentController.index);
router.post('/upload', (req, res, next) => {
  uploadPdf.single('file')(req, res, (err) => {
    if (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return renderUploadError(req, res, 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10 MB)');
      }
      return renderUploadError(req, res, 'อัปโหลดไฟล์ล้มเหลว');
    }
    next();
  });
}, documentController.upload);
router.get('/view/:id', documentController.view);
router.get('/view/:id/file', documentController.viewFile);
router.get('/download/:id', documentController.download);
router.post('/delete/:id', documentController.delete);

module.exports = router;
