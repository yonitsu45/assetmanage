const { Router } = require('express');
const router = Router();
const dashboardController = require('../controllers/dashboardController');
const { requireSuperAdmin } = require('../middleware/auth');

router.get('/', dashboardController.index);
router.post('/clear', requireSuperAdmin, dashboardController.clear);
router.post('/edit/:asset_id', dashboardController.edit);
router.post('/delete/:asset_id', dashboardController.deleteAsset);

module.exports = router;
