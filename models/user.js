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
  }
};

module.exports = User;
