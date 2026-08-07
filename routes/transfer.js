const { Router } = require('express');
const router = Router();
const transferController = require('../controllers/transferController');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');

router.get('/', requireAdminOrSuperAdmin, transferController.index);
router.get('/search', requireAdminOrSuperAdmin, transferController.searchAssets);
router.post('/create', requireAdminOrSuperAdmin, transferController.create);

module.exports = router;
