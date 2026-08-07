const fs = require('fs');
const path = require('path');
const Document = require('../models/document');
const ActivityLog = require('../models/activityLog');

const pdfDir = path.join(__dirname, '..', 'documents');

function safeDirName(name) {
  return String(name || 'unassigned')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim() || 'unassigned';
}

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

function effectiveDept(req) {
  if (req.session.role === 'super_admin') {
    return { dept: req.query.dept || '', userDeptEmpty: false };
  }
  const dept = req.session.department;
  return { dept: dept || '', userDeptEmpty: !dept };
}

function canAccessDoc(req, doc) {
  if (req.session.role === 'super_admin') return true;
  return !!(doc.department && req.session.department && doc.department === req.session.department);
}

const documentController = {
  async renderIndex(req, res, { error }) {
    const o = buildOptsFromQuery(req);
    const eff = effectiveDept(req);
    let documents = [];
    if (!eff.userDeptEmpty) {
      const docs = await Document.getAll({ department: eff.dept || undefined, search: o.search, sortBy: o.sortBy, order: o.order });
      documents = formatDocs(docs);
    }
    res.render('documents', {
      documents, error: error || null,
      userId: req.session.userId,
      userRole: req.session.role,
      userDept: req.session.department,
      userDeptEmpty: eff.userDeptEmpty,
      currentDept: eff.dept,
      searchKeyword: o.currentSearch,
      currentSortBy: o.currentSortBy,
      currentOrder: o.currentOrder
    });
  },

  async index(req, res) {
    try {
      await documentController.renderIndex(req, res, { error: null });
    } catch (err) {
      console.error('Document list error:', err);
      res.status(500).send('Server error');
    }
  },

  async upload(req, res) {
    const o = buildOptsFromQuery(req);
    const isSuper = req.session.role === 'super_admin';
    const uploadDept = isSuper ? String(req.query.dept || req.body.dept || '').trim() : (req.session.department || '');

    if (req.session.role === 'user') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return documentController.renderIndex(req, res, { error: req.__('documents.error_no_permission_upload') });
    }

    if (!req.file) {
      return documentController.renderIndex(req, res, { error: req.__('documents.error_no_file') });
    }

    if (!uploadDept) {
      fs.unlink(req.file.path, () => {});
      return documentController.renderIndex(req, res, { error: req.__('documents.upload_select_dept') });
    }

    let finalPath = req.file.path;
    try {
      const deptDir = path.join(pdfDir, safeDirName(uploadDept));
      fs.mkdirSync(deptDir, { recursive: true });
      finalPath = path.join(deptDir, path.basename(req.file.path));
      fs.renameSync(req.file.path, finalPath);

      await Document.create({
        filename: path.basename(finalPath),
        original_name: req.file.originalname,
        filepath: finalPath,
        filesize: req.file.size,
        uploaded_by: req.session.userId,
        department: uploadDept
      });
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'upload',
        module: 'document',
        target: req.file.originalname,
        details: JSON.stringify({ filesize: req.file.size, department: uploadDept })
      });
      const qstr = buildQueryString(o);
      return res.redirect('/documents' + (qstr ? '?' + qstr : ''));
    } catch (err) {
      console.error('Document upload error:', err);
      fs.unlink(req.file.path, () => {});
      if (finalPath !== req.file.path) fs.unlink(finalPath, () => {});
      return documentController.renderIndex(req, res, { error: req.__('documents.error_upload') });
    }
  },

  async view(req, res) {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc || !canAccessDoc(req, doc)) return res.status(404).send('File not found');
      res.render('document-view', { doc });
    } catch (err) {
      console.error('Document view error:', err);
      res.status(500).send('Server error');
    }
  },

  async viewFile(req, res) {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc || !canAccessDoc(req, doc)) return res.status(404).send('File not found');
      if (!fs.existsSync(doc.filepath)) return res.status(404).send('File not found on disk');
      res.contentType('application/pdf');
      res.sendFile(path.resolve(doc.filepath));
    } catch (err) {
      console.error('Document file error:', err);
      res.status(500).send('Server error');
    }
  },

  async download(req, res) {
    try {
      const doc = await Document.findById(req.params.id);
      if (!doc || !canAccessDoc(req, doc)) return res.status(404).send('File not found');
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

      const userRole = req.session.role;
      const userDept = req.session.department;

      if (userRole !== 'super_admin') {
        let allowed = false;
        if (userRole === 'admin' && doc.department && userDept && doc.department === userDept) allowed = true;
        if (!allowed) {
          return documentController.renderIndex(req, res, { error: req.__('documents.error_delete') });
        }
      }

      fs.unlink(doc.filepath, () => {});
      await Document.deleteById(doc.id);
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'delete',
        module: 'document',
        target: doc.original_name,
        details: JSON.stringify({ department: doc.department })
      });

      const o = buildOptsFromQuery(req);
      const qstr = buildQueryString(o);
      res.redirect('/documents' + (qstr ? '?' + qstr : ''));
    } catch (err) {
      console.error('Document delete error:', err);
      res.status(500).send('Server error');
    }
  }
};

module.exports = documentController;
