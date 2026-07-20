const { pool } = require('../config/db');

const User = {
  async create({ username, email, password, full_name, role, department }) {
    const sql = 'INSERT INTO users (username, email, password, full_name, role, department) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await pool.query(sql, [username, email, password, full_name || null, role || 'user', department || null]);
    return result.insertId;
  },

  async findByUsername(username) {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT id, username, email, full_name, role, department, created_at FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async getAll({ sortBy, order } = {}) {
    const allowedSorts = ['id', 'username', 'email', 'full_name', 'role', 'department', 'created_at'];
    const sort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const dir = order === 'ASC' ? 'ASC' : 'DESC';
    const [rows] = await pool.query(`SELECT id, username, email, full_name, role, department, created_at FROM users ORDER BY \`${sort}\` ${dir}`);
    return rows;
  },

  async update(id, data) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`\`${key}\` = ?`);
      params.push(value === '' ? null : value);
    }
    if (fields.length === 0) return 0;
    params.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    const [result] = await pool.query(sql, params);
    return result.affectedRows;
  },

  async changePassword(id, hashedPassword) {
    const sql = 'UPDATE users SET password = ? WHERE id = ?';
    const [result] = await pool.query(sql, [hashedPassword, id]);
    return result.affectedRows;
  },

  async findByIdWithPassword(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows;
  }
};

module.exports = User;
