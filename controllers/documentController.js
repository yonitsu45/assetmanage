const fs = require('fs');
const path = require('path');
const Document = require('../models/document');

const documentController = {
  async index(req, res) {
    try {
      const documents = await Document.getAll();
      res.render('documents', { documents, error: null });
    } catch (err) {
      console.error('Document list error:', err);
      res.status(500).send('Server error');
    }
  },

  async upload(req, res) {
    if (!req.file) {
      const documents = await Document.getAll();
      return res.render('documents', { documents, error: 'กรุณาเลือกไฟล์ PDF' });
    }

    try {
      const file = req.file;
      await Document.create({
        filename: file.filename,
        original_name: file.originalname,
        filepath: file.path,
        filesize: file.size,
        uploaded_by: req.session.userId
      });
      res.redirect('/documents');
    } catch (err) {
      console.error('Document upload error:', err);
      fs.unlink(req.file.path, () => {});
      const documents = await Document.getAll();
      res.render('documents', { documents, error: 'อัปโหลดไฟล์ล้มเหลว' });
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
      if (userRole !== 'admin' && doc.uploaded_by !== userId) {
        const documents = await Document.getAll();
        return res.render('documents', { documents, error: 'คุณไม่มีสิทธิ์ลบไฟล์นี้' });
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
