const { Router } = require('express');
const router = Router();
const dashboardController = require('../controllers/dashboardController');
const { requireSuperAdmin } = require('../middleware/auth');

router.get('/', dashboardController.index);
router.get('/export', dashboardController.exportExcel);
router.get('/asset/:asset_id', dashboardController.detail);
router.post('/clear', requireSuperAdmin, dashboardController.clear);
router.post('/edit/:asset_id', requireSuperAdmin, dashboardController.edit);
router.post('/delete/:asset_id', requireSuperAdmin, dashboardController.deleteAsset);
router.post('/bulk-status', requireSuperAdmin, dashboardController.bulkStatus);

module.exports = router;
