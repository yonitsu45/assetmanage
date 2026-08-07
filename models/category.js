const { pool } = require('../config/db');

const Category = {
  async getAll() {
    const [rows] = await pool.query('SELECT id, code, name, created_at FROM categories ORDER BY name ASC');
    return rows;
  },

  async create(code, name) {
    const sql = 'INSERT INTO categories (code, name) VALUES (?, ?)';
    const [result] = await pool.query(sql, [code, name]);
    return result.insertId;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (fields.length === 0) return 0;
    values.push(id);
    const [result] = await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return result.affectedRows;
  },

  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    return result.affectedRows;
  },

  async getByCode(code) {
    if (!code) return null;
    const [rows] = await pool.query('SELECT id, code, name FROM categories WHERE code = ?', [code]);
    return rows[0] || null;
  },

  async getByName(name) {
    const [rows] = await pool.query('SELECT id FROM categories WHERE name = ?', [name]);
    return rows[0] || null;
  }
};

module.exports = Category;
