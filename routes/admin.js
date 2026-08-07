const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middleware/upload');
const fs = require('fs');

router.get('/users', adminController.index);
router.post('/users/edit/:id', adminController.edit);
router.post('/users/password/:id', adminController.changePassword);
router.post('/users/delete/:id', adminController.deleteUser);

router.get('/departments', adminController.departments);
router.post('/departments/add', adminController.addDepartment);
router.post('/departments/delete/:id', adminController.deleteDepartment);
router.post('/departments/import', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.redirect('/admin/users?error=dept_file_too_large');
      }
      return res.redirect('/admin/users?error=dept_bad_file');
    }
    next();
  });
}, adminController.importDepartments);

router.get('/categories', adminController.categories);
router.post('/categories/add', adminController.addCategory);
router.post('/categories/delete/:id', adminController.deleteCategory);
router.post('/categories/import', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.redirect('/admin/users?error=cat_file_too_large');
      }
      return res.redirect('/admin/users?error=cat_bad_file');
    }
    next();
  });
}, adminController.importCategories);

module.exports = router;
