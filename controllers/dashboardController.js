const Asset = require('../models/asset');

// Parse comma-separated filter values from query (supports either ?key=a&key=b or ?key=a,b)
const parseFilter = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(',').map(s => s.trim()).filter(Boolean);
};

const dashboardController = {
  async index(req, res) {
    try {
      const search = req.query.search || '';
      const categories = parseFilter(req.query.categories);
      const statuses = parseFilter(req.query.statuses);
      const departments = parseFilter(req.query.departments);
      const sortBy = req.query.sort_by || 'created_at';
      const order = req.query.order || 'DESC';
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 25;

      const data = await Asset.getAll({ search, categories, statuses, departments, sortBy, order, page, limit });
      const summary = await Asset.getSummary();
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
        reqQuery: req.query
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).send('Server error');
    }
  },

  async clear(req, res) {
    try {
      const deleted = await Asset.deleteAll();
      res.redirect('/?cleared=' + deleted);
    } catch (err) {
      console.error('Clear error:', err);
      res.status(500).send('Server error');
    }
  },

  async edit(req, res) {
    try {
      const { asset_id } = req.params;
      const userId = req.session.userId;
      const role = req.session.role;

      const asset = await Asset.getById(asset_id);
      if (!asset) return res.redirect('/?error=not_found');
      if (role !== 'admin' && (!asset.uploaded_by || asset.uploaded_by !== userId)) {
        return res.redirect('/?error=permission_denied');
      }

      const allowed = ['business_unit', 'tag_numbe', 'descr', 'descr_long', 'model', 'plant', 'serial_id', 'vendor_id', 'vendor_name', 'deptid', 'dept_name', 'category', 'x_asset_status', 'asset_status', 'x_asset_reason', 'x_agreement_id'];
      const data = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }
      if (Object.keys(data).length === 0) {
        return res.redirect('/?error=no_fields');
      }
      const affected = await Asset.update(asset_id, data);
      if (affected === 0) {
        return res.redirect('/?error=not_found');
      }
      res.redirect('/?updated=' + encodeURIComponent(asset_id));
    } catch (err) {
      console.error('Edit error:', err);
      res.redirect('/?error=edit_failed');
    }
  },

  async deleteAsset(req, res) {
    try {
      const { asset_id } = req.params;
      const userId = req.session.userId;
      const role = req.session.role;

      const asset = await Asset.getById(asset_id);
      if (!asset) return res.redirect('/?error=not_found');
      if (role !== 'admin' && (!asset.uploaded_by || asset.uploaded_by !== userId)) {
        return res.redirect('/?error=permission_denied');
      }

      await Asset.deleteById(asset_id);
      res.redirect('/?deleted=' + encodeURIComponent(asset_id));
    } catch (err) {
      console.error('Delete error:', err);
      res.redirect('/?error=delete_failed');
    }
  }
};

module.exports = dashboardController;
