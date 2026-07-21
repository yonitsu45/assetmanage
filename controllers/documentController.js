const fs = require('fs');
const path = require('path');
const Document = require('../models/document');

function formatDocs(docs) {
  return docs.map(function(d) {
    d.formatted_date = d.uploaded_at
      ? (typeof d.uploaded_at === 'string'
          ? d.uploaded_at.slice(0, 10).replace(/-/g, '/')
          : d.uploaded_at.toLocaleDateString('en-CA').replace(/-/g, '/'))
      : '';
    return d;
  });
}

function buildOptsFromQuery(req) {
  return {
    department: req.query.dept || undefined,
    search: req.query.search || undefined,
    sortBy: req.query.sort_by || 'uploaded_at',
    order: req.query.order || 'DESC',
    currentDept: req.query.dept || '',
    currentSearch: req.query.search || '',
    currentSortBy: req.query.sort_by || 'uploaded_at',
    currentOrder: req.query.order || 'DESC'
  };
}

function buildQueryString(opts) {
  const qs = new URLSearchParams();
  if (opts.currentDept) qs.set('dept', opts.currentDept);
  if (opts.currentSearch) qs.set('search', opts.currentSearch);
  if (opts.currentSortBy !== 'uploaded_at') qs.set('sort_by', opts.currentSortBy);
  if (opts.currentOrder !== 'DESC') qs.set('order', opts.currentOrder);
  return qs.toString();
}

const documentController = {
  async index(req, res) {
    try {
      const o = buildOptsFromQuery(req);
      const docs = await Document.getAll({ department: o.department, search: o.search, sortBy: o.sortBy, order: o.order });
      const documents = formatDocs(docs);
      res.render('documents', {
        documents, error: null,
        userId: req.session.userId,
        userRole: req.session.role,
        userDept: req.session.department,
        currentDept: o.currentDept,
        searchKeyword: o.currentSearch,
        currentSortBy: o.currentSortBy,
        currentOrder: o.currentOrder
      });
    } catch (err) {
      console.error('Document list error:', err);
      res.status(500).send('Server error');
    }
  },

  async upload(req, res) {
    const o = buildOptsFromQuery(req);
    const queryOpts = { department: o.department, search: o.search, sortBy: o.sortBy, order: o.order };

    if (!req.file) {
      const docs = await Document.getAll(queryOpts);
      const documents = formatDocs(docs);
      return res.render('documents', {
        documents, error: 'กรุณาเลือกไฟล์ PDF',
        userId: req.session.userId, userRole: req.session.role, userDept: req.session.department,
        currentDept: o.currentDept, searchKeyword: o.currentSearch,
        currentSortBy: o.currentSortBy, currentOrder: o.currentOrder
      });
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
      const qstr = buildQueryString(o);
      res.redirect('/documents' + (qstr ? '?' + qstr : ''));
    } catch (err) {
      console.error('Document upload error:', err);
      fs.unlink(req.file.path, () => {});
      const docs = await Document.getAll(queryOpts);
      const documents = formatDocs(docs);
      res.render('documents', {
        documents, error: 'อัปโหลดไฟล์ล้มเหลว',
        userId: req.session.userId, userRole: req.session.role, userDept: req.session.department,
        currentDept: o.currentDept, searchKeyword: o.currentSearch,
        currentSortBy: o.currentSortBy, currentOrder: o.currentOrder
      });
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

      const o = buildOptsFromQuery(req);
      const userId = req.session.userId;
      const userRole = req.session.role;
      const userDept = req.session.department;

      if (userRole !== 'super_admin') {
        let allowed = false;
        if (userRole === 'admin' && doc.department && userDept && doc.department === userDept) allowed = true;
        else if (userRole === 'user' && doc.uploaded_by === userId) allowed = true;
        if (!allowed) {
          const queryOpts = { department: o.department, search: o.search, sortBy: o.sortBy, order: o.order };
          const docs = await Document.getAll(queryOpts);
          const documents = formatDocs(docs);
          return res.render('documents', {
            documents, error: 'คุณไม่มีสิทธิ์ลบไฟล์นี้',
            userId, userRole: req.session.role, userDept: req.session.department,
            currentDept: o.currentDept, searchKeyword: o.currentSearch,
            currentSortBy: o.currentSortBy, currentOrder: o.currentOrder
          });
        }
      }

      fs.unlink(doc.filepath, () => {});
      await Document.deleteById(doc.id);

      const qstr = buildQueryString(o);
      res.redirect('/documents' + (qstr ? '?' + qstr : ''));
    } catch (err) {
      console.error('Document delete error:', err);
      res.status(500).send('Server error');
    }
  }
};

module.exports = documentController;
