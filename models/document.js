const { pool } = require('../config/db');

const Document = {
  async create({ filename, original_name, filepath, filesize, uploaded_by, department }) {
    const sql = 'INSERT INTO documents (filename, original_name, filepath, filesize, uploaded_by, department) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await pool.query(sql, [filename, original_name, filepath, filesize, uploaded_by || null, department || null]);
    return result.insertId;
  },

  async getAll({ department } = {}) {
    let sql = 'SELECT d.*, u.full_name AS uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id';
    const params = [];
    if (department) {
      sql += ' WHERE d.department = ?';
      params.push(department);
    }
    sql += ' ORDER BY d.uploaded_at DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT d.*, u.full_name AS uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM documents WHERE id = ?', [id]);
    return result.affectedRows;
  }
};

module.exports = Document;
