const { Router } = require('express');
const router = Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/upload');

router.get('/', uploadController.showUpload);
router.post('/file', upload.single('file'), uploadController.handleUpload);
router.post('/manual', uploadController.handleManualEntry);

module.exports = router;
