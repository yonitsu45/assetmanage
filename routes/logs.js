const { Router } = require('express');
const router = Router();
const logController = require('../controllers/logController');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');

router.get('/', requireAdminOrSuperAdmin, logController.index);

module.exports = router;
