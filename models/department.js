const { pool } = require('../config/db');

const Department = {
  async getAll() {
    const [rows] = await pool.query('SELECT id, name, costcenter, created_at FROM departments ORDER BY name ASC');
    return rows;
  },

  async create(name, costcenter) {
    const sql = 'INSERT INTO departments (name, costcenter) VALUES (?, ?)';
    const [result] = await pool.query(sql, [name, costcenter || null]);
    return result.insertId;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.costcenter !== undefined) { fields.push('costcenter = ?'); values.push(data.costcenter); }
    if (fields.length === 0) return 0;
    values.push(id);
    const [result] = await pool.query(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, values);
    return result.affectedRows;
  },

  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    return result.affectedRows;
  },

  async getByName(name) {
    const [rows] = await pool.query('SELECT id FROM departments WHERE name = ?', [name]);
    return rows[0] || null;
  },

  async getByCostcenter(costcenter) {
    if (!costcenter) return null;
    const [rows] = await pool.query('SELECT id, name, costcenter FROM departments WHERE costcenter = ?', [costcenter]);
    return rows[0] || null;
  }
};

module.exports = Department;
