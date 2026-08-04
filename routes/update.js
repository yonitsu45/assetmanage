const { Router } = require('express');
const router = Router();
const updateController = require('../controllers/updateController');
const upload = require('../middleware/upload');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');

router.get('/', requireAdminOrSuperAdmin, updateController.show);
router.post('/preview', requireAdminOrSuperAdmin, upload.single('file'), updateController.preview);
router.post('/apply', requireAdminOrSuperAdmin, updateController.apply);
router.post('/cancel', requireAdminOrSuperAdmin, updateController.cancel);

module.exports = router;
