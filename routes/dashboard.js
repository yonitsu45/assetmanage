const { Router } = require('express');
const router = Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAdminOrSuperAdmin } = require('../middleware/auth');
const { csrfCheck } = require('../middleware/csrf');

router.get('/', dashboardController.index);
router.get('/export', dashboardController.exportExcel);
router.get('/asset/:asset_id', dashboardController.detail);
router.post('/clear', requireAdminOrSuperAdmin, csrfCheck, dashboardController.clear);
router.post('/edit/:asset_id', requireAdminOrSuperAdmin, csrfCheck, dashboardController.edit);
router.post('/delete/:asset_id', requireAdminOrSuperAdmin, csrfCheck, dashboardController.deleteAsset);
router.post('/bulk-status', requireAdminOrSuperAdmin, csrfCheck, dashboardController.bulkStatus);

module.exports = router;
