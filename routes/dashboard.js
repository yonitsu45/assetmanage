const { Router } = require('express');
const router = Router();
const dashboardController = require('../controllers/dashboardController');
const { requireSuperAdmin } = require('../middleware/auth');
const { csrfCheck } = require('../middleware/csrf');

router.get('/', dashboardController.index);
router.get('/export', dashboardController.exportExcel);
router.get('/asset/:asset_id', dashboardController.detail);
router.post('/clear', requireSuperAdmin, csrfCheck, dashboardController.clear);
router.post('/edit/:asset_id', requireSuperAdmin, csrfCheck, dashboardController.edit);
router.post('/delete/:asset_id', requireSuperAdmin, csrfCheck, dashboardController.deleteAsset);
router.post('/bulk-status', requireSuperAdmin, csrfCheck, dashboardController.bulkStatus);

module.exports = router;
