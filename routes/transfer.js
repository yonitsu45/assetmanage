const { Router } = require('express');
const router = Router();
const transferController = require('../controllers/transferController');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');
const { csrfCheck } = require('../middleware/csrf');

router.get('/', requireAdminOrSuperAdmin, transferController.index);
router.get('/search', requireAdminOrSuperAdmin, transferController.searchAssets);
router.post('/create', requireAdminOrSuperAdmin, csrfCheck, transferController.create);

module.exports = router;
