const { pool } = require('../config/db');
const Asset = require('../models/asset');
const Transfer = require('../models/transfer');
const ActivityLog = require('../models/activityLog');

const transferController = {
  async index(req, res) {
    try {
      const search = req.query.search || '';
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const history = await Transfer.getAll({ search, page, limit });
      res.render('transfer', {
        history,
        search,
        page,
        limit,
        departments: res.locals.deptList || [],
        success: req.query.success || null,
        error: req.query.error || null,
        errorCount: req.query.count || null
      });
    } catch (err) {
      console.error('Transfer index error:', err);
      res.status(500).send('Server error');
    }
  },

  async searchAssets(req, res) {
    try {
      const q = (req.query.q || '').trim();
      if (!q) return res.json([]);
      const [rows] = await pool.query(
        `SELECT asset_id, descr, dept_name, asset_status FROM assets
         WHERE asset_id LIKE ? OR tag_number LIKE ? OR descr LIKE ?
         ORDER BY asset_id LIMIT 10`,
        [`%${q}%`, `%${q}%`, `%${q}%`]
      );
      res.json(rows);
    } catch (err) {
      console.error('Transfer search error:', err);
      res.status(500).json({ error: 'search_failed' });
    }
  },

  async create(req, res) {
    try {
      let ids = req.body.asset_ids;
      if (!Array.isArray(ids)) ids = ids ? [ids] : [];
      ids = ids.map(String).filter(Boolean);
      const toDept = (req.body.to_dept || '').toString().trim();
      const note = (req.body.note || '').toString().trim();

      if (ids.length === 0) return res.redirect('/transfer?error=no_selection');
      if (!toDept) return res.redirect('/transfer?error=no_dept');

      const assetMap = await Asset.getByAssetIds(ids);
      const missing = ids.filter(id => !assetMap.has(id));
      if (missing.length > 0) return res.redirect('/transfer?error=not_found&count=' + missing.length);

      const assets = Array.from(assetMap.values());
      const toMove = assets.filter(a => (a.dept_name || '') !== toDept);
      if (toMove.length === 0) return res.redirect('/transfer?error=no_change&count=' + assets.length);

      const moveIds = toMove.map(a => a.asset_id);
      await Asset.bulkTransferDepartment(moveIds, toDept, req.session.userId);
      for (const asset of toMove) {
        await Transfer.create({
          asset_id: asset.asset_id,
          from_dept: asset.dept_name || '',
          to_dept: toDept,
          note,
          transferred_by: req.session.userId,
          transferred_by_name: req.session.username
        });
      }

      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'transfer',
        module: 'asset',
        target: null,
        details: JSON.stringify({ to_dept: toDept, count: moveIds.length, asset_ids: moveIds, note: note || null })
      });

      res.redirect('/transfer?success=' + moveIds.length);
    } catch (err) {
      console.error('Transfer create error:', err);
      res.redirect('/transfer?error=failed');
    }
  }
};

module.exports = transferController;
