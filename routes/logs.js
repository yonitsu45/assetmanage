const { Router } = require('express');
const router = Router();
const logController = require('../controllers/logController');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');

router.get('/', requireAdminOrSuperAdmin, logController.index);
router.get('/detail/:id', requireAdminOrSuperAdmin, logController.detail);

module.exports = router;
