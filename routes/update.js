const { Router } = require('express');
const router = Router();
const updateController = require('../controllers/updateController');
const upload = require('../middleware/upload');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');
const { csrfCheck } = require('../middleware/csrf');

router.get('/', requireAdminOrSuperAdmin, updateController.show);
router.post('/preview', requireAdminOrSuperAdmin, upload.single('file'), csrfCheck, updateController.preview);
router.post('/apply', requireAdminOrSuperAdmin, csrfCheck, updateController.apply);
router.post('/cancel', requireAdminOrSuperAdmin, csrfCheck, updateController.cancel);

module.exports = router;
