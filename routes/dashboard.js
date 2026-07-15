const { Router } = require('express');
const router = Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/', dashboardController.index);
router.post('/clear', dashboardController.clear);

module.exports = router;
