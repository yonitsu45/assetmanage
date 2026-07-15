const { Router } = require('express');
const router = Router();
const path = require('path');
const fs = require('fs');
const documentController = require('../controllers/documentController');
const { uploadPdf } = require('../middleware/upload');
const Document = require('../models/document');

router.get('/', documentController.index);
router.post('/upload', uploadPdf.single('file'), documentController.upload);
router.get('/view/:id', documentController.view);
router.get('/download/:id', documentController.download);
router.post('/delete/:id', documentController.delete);

// Serve the actual PDF file for the embed viewer
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
