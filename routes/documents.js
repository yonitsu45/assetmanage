const { Router } = require('express');
const router = Router();
const path = require('path');
const fs = require('fs');
const documentController = require('../controllers/documentController');
const { uploadPdf } = require('../middleware/upload');
const Document = require('../models/document');

router.get('/', documentController.index);
router.post('/upload', (req, res, next) => {
  uploadPdf.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        Document.getAll().then(documents => {
          res.render('documents', { documents, error: 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10 MB)' });
        }).catch(() => {
          res.render('documents', { documents: [], error: 'ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10 MB)' });
        });
      } else {
        Document.getAll().then(documents => {
          res.render('documents', { documents, error: 'อัปโหลดไฟล์ล้มเหลว' });
        }).catch(() => {
          res.render('documents', { documents: [], error: 'อัปโหลดไฟล์ล้มเหลว' });
        });
      }
      return;
    }
    next();
  });
}, documentController.upload);
router.get('/view/:id', documentController.view);
router.get('/download/:id', documentController.download);
router.post('/delete/:id', documentController.delete);

router.get('/view/:id/file', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).send('File not found');
    if (!fs.existsSync(doc.filepath)) return res.status(404).send('File not found on disk');
    res.contentType('application/pdf');
    res.sendFile(path.resolve(doc.filepath));
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
