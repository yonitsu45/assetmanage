const fs = require('fs');
const path = require('path');
const Document = require('../models/document');

const documentController = {
  async index(req, res) {
    try {
      const deptFilter = req.query.dept || '';
      const documents = await Document.getAll({ department: deptFilter || undefined });
      res.render('documents', { documents, error: null, userId: req.session.userId, userRole: req.session.role, userDept: req.session.department, currentDept: deptFilter });
    } catch (err) {
      console.error('Document list error:', err);
      res.status(500).send('Server error');
    }
  },

  async upload(req, res) {
    const currentDept = req.query.dept || '';
    if (!req.file) {
      const documents = await Document.getAll({ department: currentDept || undefined });
      return res.render('documents', { documents, error: 'กรุณาเลือกไฟล์ PDF', userId: req.session.userId, userRole: req.session.role, userDept: req.session.department, currentDept: currentDept || '' });
    }

    try {
      const file = req.file;
      await Document.create({
        filename: file.filename,
        original_name: file.originalname,
        filepath: file.path,
        filesize: file.size,
        uploaded_by: req.session.userId,
        department: req.session.department
      });
      res.redirect('/documents');
    } catch (err) {
      console.error('Document upload error:', err);
      fs.unlink(req.file.path, () => {});
      const documents = await Document.getAll({ department: currentDept || undefined });
      res.render('documents', { documents, error: 'อัปโหลดไฟล์ล้มเหลว', userId: req.session.userId, userRole: req.session.role, userDept: req.session.department, currentDept: currentDept || '' });
    }
  },

  async view(req, res) {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc) return res.status(404).send('File not found');
      res.render('document-view', { doc });
    } catch (err) {
      console.error('Document view error:', err);
      res.status(500).send('Server error');
    }
  },

  async download(req, res) {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc) return res.status(404).send('File not found');
      if (!fs.existsSync(doc.filepath)) return res.status(404).send('File not found on disk');
      res.download(doc.filepath, doc.original_name);
    } catch (err) {
      console.error('Document download error:', err);
      res.status(500).send('Server error');
    }
  },

  async delete(req, res) {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc) return res.redirect('/documents');

      const userId = req.session.userId;
      const userRole = req.session.role;
      const userDept = req.session.department;
      const currentDept = req.query.dept || '';

      if (userRole !== 'super_admin') {
        if (userRole === 'admin' && doc.department && userDept && doc.department === userDept) {
          // department admin, same department — allowed
        } else if (userRole === 'user' && doc.uploaded_by === userId) {
          // regular user, own upload — allowed
        } else {
          const documents = await Document.getAll({ department: currentDept || undefined });
          return res.render('documents', { documents, error: 'คุณไม่มีสิทธิ์ลบไฟล์นี้', userId, userRole: req.session.role, userDept: req.session.department, currentDept });
        }
      }

      fs.unlink(doc.filepath, () => {});
      await Document.deleteById(doc.id);
      res.redirect('/documents');
    } catch (err) {
      console.error('Document delete error:', err);
      res.status(500).send('Server error');
    }
  }
};

module.exports = documentController;
