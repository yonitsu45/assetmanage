const { Router } = require('express');
const router = Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/asset/:asset_id', dashboardController.detail);

module.exports = router;