const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/users', adminController.index);
router.post('/users/edit/:id', adminController.edit);
router.post('/users/password/:id', adminController.changePassword);
router.post('/users/delete/:id', adminController.deleteUser);

router.get('/departments', adminController.departments);
router.post('/departments/add', adminController.addDepartment);
router.post('/departments/delete/:id', adminController.deleteDepartment);

module.exports = router;
