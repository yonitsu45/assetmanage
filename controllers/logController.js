const ActivityLog = require('../models/activityLog');

const logController = {
  async index(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 25;
      const module = req.query.module || '';
      const action = req.query.action || '';
      const search = req.query.search || '';

      const data = await ActivityLog.list({ page, limit, module, action, search });
      const modules = await ActivityLog.getModules();
      const actions = await ActivityLog.getActions();

      res.render('logs', {
        logs: data.rows,
        modules,
        actions,
        module,
        action,
        search,
        page: data.page,
        totalPages: data.totalPages,
        total: data.total,
        limit
      });
    } catch (err) {
      console.error('Logs error:', err);
      res.status(500).send('Server error');
    }
  }
};

module.exports = logController;
