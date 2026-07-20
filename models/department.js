const { pool } = require('../config/db');

const Department = {
  async getAll() {
    const [rows] = await pool.query('SELECT id, name, created_at FROM departments ORDER BY name ASC');
    return rows;
  },

  async create(name) {
    const sql = 'INSERT INTO departments (name) VALUES (?)';
    const [result] = await pool.query(sql, [name]);
    return result.insertId;
  },

  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    return result.affectedRows;
  },

  async getByName(name) {
    const [rows] = await pool.query('SELECT id FROM departments WHERE name = ?', [name]);
    return rows[0] || null;
  }
};

module.exports = Department;
