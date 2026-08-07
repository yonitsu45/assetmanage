const { pool } = require('../config/db');

const ActivityLog = {
  async create({ userId, username, action, module, target, details }) {
    const [result] = await pool.query(
      `INSERT INTO activity_logs (user_id, username, action, module, target, details) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, username || null, action || null, module || null, target || null, details || null]
    );
    return result.insertId;
  },

  async list({ page, limit, module, action, search }) {
    const conditions = [];
    const params = [];
    if (module) {
      conditions.push('module = ?');
      params.push(module);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (search) {
      conditions.push('(target LIKE ? OR details LIKE ? OR username LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Number(limit) || 25;
    const safePage = Number(page) || 1;
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM activity_logs ${where}`, params);
    const total = countRows[0].total;

    const sql = `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`;
    const [rows] = await pool.query(sql, params);

    return { rows, total, page: safePage, totalPages: Math.ceil(total / safeLimit), limit: safeLimit };
  },

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM activity_logs WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async getModules() {
    const [rows] = await pool.query(`SELECT DISTINCT module FROM activity_logs WHERE module IS NOT NULL AND module != '' ORDER BY module`);
    return rows.map(r => r.module);
  },

  async getActions() {
    const [rows] = await pool.query(`SELECT DISTINCT action FROM activity_logs WHERE action IS NOT NULL AND action != '' ORDER BY action`);
    return rows.map(r => r.action);
  }
};

module.exports = ActivityLog;
