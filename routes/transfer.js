const { Router } = require('express');
const router = Router();
const transferController = require('../controllers/transferController');
const { requireSuperAdmin } = require('../middleware/auth');
const { csrfCheck } = require('../middleware/csrf');

router.get('/', requireSuperAdmin, transferController.index);
router.get('/search', requireSuperAdmin, transferController.searchAssets);
router.post('/create', requireSuperAdmin, csrfCheck, transferController.create);

module.exports = router;
