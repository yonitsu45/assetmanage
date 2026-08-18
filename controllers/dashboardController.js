const Asset = require('../models/asset');
const ActivityLog = require('../models/activityLog');
const Transfer = require('../models/transfer');
const XLSX = require('xlsx');

// Parse comma-separated filter values from query (supports either ?key=a&key=b or ?key=a,b)
const parseFilter = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

// Non-super-admin users are locked to their own department.
// Returns { departments, userDeptEmpty } where departments is the effective filter list.
const effectiveDepartments = (req) => {
  if (req.session.role !== 'super_admin') {
    const dept = req.session.department || null;
    if (!dept) return { departments: ['__none__'], userDeptEmpty: true };
    return { departments: [dept], userDeptEmpty: false };
  }
  return { departments: parseFilter(req.query.departments), userDeptEmpty: false };
};

const dashboardController = {
  async index(req, res) {
    try {
      const search = req.query.search || '';
      const categories = parseFilter(req.query.categories);
      const statuses = parseFilter(req.query.statuses);
      const { departments, userDeptEmpty } = effectiveDepartments(req);
      const sortBy = req.query.sort_by || 'created_at';
      const order = req.query.order || 'DESC';
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));

      const data = await Asset.getAll({ search, categories, statuses, departments, sortBy, order, page, limit });
      const summary = await Asset.getSummary(departments);
      const allCategories = await Asset.getCategories();
      const allStatuses = await Asset.getStatuses();
      const allDepartments = await Asset.getDepartments();
      const cleared = req.query.cleared || null;

      res.render('dashboard', {
        assets: data.rows,
        summary,
        search,
        categories,
        statuses,
        departments,
        allCategories,
        allStatuses,
        allDepartments,
        sortBy,
        order,
        page: data.page,
        totalPages: data.totalPages,
        total: data.total,
        limit,
        cleared,
        userDeptEmpty,
        reqQuery: req.query
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).send('Server error');
    }
  },

  async detail(req, res) {
    try {
      const asset = await Asset.getById(req.params.asset_id);
      if (!asset) return res.status(404).render('asset-detail', { asset: null, error: req.__('asset_detail.not_found') });
      if (req.session.role !== 'super_admin' && asset.dept_name !== req.session.department) {
        return res.status(404).render('asset-detail', { asset: null, error: req.__('asset_detail.not_found') });
      }
      const history = await Transfer.getByAsset(asset.asset_id);
      res.render('asset-detail', { asset, error: null, history });
    } catch (err) {
      console.error('Asset detail error:', err);
      res.status(500).send('Server error');
    }
  },

  async clear(req, res) {
    try {
      const deleted = await Asset.deleteAll();
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'clear',
        module: 'asset',
        target: null,
        details: JSON.stringify({ deleted })
      });
      res.redirect('/?cleared=' + deleted);
    } catch (err) {
      console.error('Clear error:', err);
      res.status(500).send('Server error');
    }
  },

  async edit(req, res) {
    try {
      const { asset_id } = req.params;

      const asset = await Asset.getById(asset_id);
      if (!asset) return res.redirect('/?error=not_found');

      const allowed = ['business_unit', 'tag_number', 'tag_number_extend', 'serial_number_asset', 'descr', 'descr_long', 'model', 'plant', 'serial_id', 'vendor_id', 'vendor_name', 'deptid', 'dept_name', 'category', 'category_name', 'x_asset_status', 'asset_status', 'x_asset_reason', 'x_agreement_id', 'expire_date'];
      const data = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }
      if (Object.keys(data).length === 0) {
        return res.redirect('/?error=no_fields');
      }
      const affected = await Asset.update(asset_id, data, req.session.userId);
      if (affected === 0) {
        return res.redirect('/?error=not_found');
      }
      const changed = allowed.filter(f => req.body[f] !== undefined && String(req.body[f] ?? '') !== String(asset[f] ?? ''));
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'update',
        module: 'asset',
        target: asset_id,
        details: JSON.stringify({ source: 'dashboard', fields: changed })
      });
      res.redirect('/?updated=' + encodeURIComponent(asset_id));
    } catch (err) {
      console.error('Edit error:', err);
      res.redirect('/?error=edit_failed');
    }
  },

  async deleteAsset(req, res) {
    try {
      const { asset_id } = req.params;

      const asset = await Asset.getById(asset_id);
      if (!asset) return res.redirect('/?error=not_found');

      await Asset.deleteById(asset_id);
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'delete',
        module: 'asset',
        target: asset_id,
        details: JSON.stringify({ descr: asset.descr, dept_name: asset.dept_name })
      });
      res.redirect('/?deleted=' + encodeURIComponent(asset_id));
    } catch (err) {
      console.error('Delete error:', err);
      res.redirect('/?error=delete_failed');
    }
  },

  async exportExcel(req, res) {
    try {
      const search = req.query.search || '';
      const categories = parseFilter(req.query.categories);
      const statuses = parseFilter(req.query.statuses);
      const { departments } = effectiveDepartments(req);
      const sortBy = req.query.sort_by || 'asset_id';
      const order = req.query.order || 'DESC';

      const rows = await Asset.getAllForExport({ search, categories, statuses, departments, sortBy, order });

      const fields = [
        'asset_id', 'business_unit', 'tag_number', 'serial_number_asset', 'tag_number_extend', 'descr', 'descr_long', 'model', 'plant',
        'serial_id', 'vendor_id', 'vendor_name', 'deptid', 'dept_name', 'category', 'category_name',
        'x_asset_status', 'asset_status', 'x_asset_reason', 'x_agreement_id',
        'expire_date',
        'uploaded_by', 'created_at', 'updated_at'
      ];
      const data = rows.map(r => {
        const o = {};
        fields.forEach(f => {
          const v = r[f];
          o[f] = (v instanceof Date) ? v.toISOString().replace('T', ' ').slice(0, 19) : (v ?? '');
        });
        return o;
      });

      const ws = XLSX.utils.json_to_sheet(data, { header: fields });
      ws['!cols'] = fields.map(f => ({ wch: Math.min(30, Math.max(10, f.length + 4)) }));
      if (ws['!ref']) ws['!autoFilter'] = { ref: ws['!ref'] };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Assets');

      const stamp = new Date();
      const pad = n => String(n).padStart(2, '0');
      const filename = `assets_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.xlsx`;

      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'export',
        module: 'asset',
        target: null,
        details: JSON.stringify({ count: rows.length, filters: { search, categories, statuses, departments } })
      });

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.error('Export error:', err);
      res.status(500).send('Export failed');
    }
  },

  async bulkStatus(req, res) {
    try {
      let ids = req.body.asset_ids;
      if (!Array.isArray(ids)) ids = ids ? [ids] : [];
      ids = ids.map(String).filter(Boolean);
      const status = (req.body.status || '').toString().trim();

      if (ids.length === 0) return res.redirect('/?error=bulk_no_selection');
      if (!status) return res.redirect('/?error=bulk_no_status');

      const affected = await Asset.bulkUpdateStatus(ids, status, req.session.userId);
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'bulk_status',
        module: 'asset',
        target: null,
        details: JSON.stringify({ status, count: affected, asset_ids: ids })
      });
      res.redirect('/?bulk_status=' + affected);
    } catch (err) {
      console.error('Bulk status error:', err);
      res.redirect('/?error=bulk_failed');
    }
  }
};

module.exports = dashboardController;
