const { pool } = require('../config/db');

const Transfer = {
  async create({ asset_id, from_dept, to_dept, note, transferred_by, transferred_by_name }) {
    const [result] = await pool.query(
      `INSERT INTO asset_transfers (asset_id, from_dept, to_dept, note, transferred_by, transferred_by_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [asset_id, from_dept, to_dept, note || null, transferred_by || null, transferred_by_name || null]
    );
    return result.insertId;
  },

  async getByAsset(asset_id) {
    const [rows] = await pool.query(
      `SELECT * FROM asset_transfers WHERE asset_id = ? ORDER BY transferred_at DESC, id DESC`,
      [asset_id]
    );
    return rows;
  },

  async getAll({ search, page, limit }) {
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('(asset_id LIKE ? OR from_dept LIKE ? OR to_dept LIKE ? OR transferred_by_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM asset_transfers ${where}`, params);
    const total = count.total;
    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(
      `SELECT * FROM asset_transfers ${where} ORDER BY transferred_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    return { rows, total, page: Number(page), totalPages: Math.ceil(total / limit) };
  }
};

module.exports = Transfer;
