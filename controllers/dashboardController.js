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
        cleared
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
  }
};

module.exports = dashboardController;
