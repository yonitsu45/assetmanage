const { pool } = require('../config/db');

const Asset = {
  async getAll({ search, categories, statuses, departments, sortBy, order, page, limit }) {
    const offset = (page - 1) * limit;
    const allowedSort = ['asset_id', 'tag_numbe', 'descr', 'descr_long', 'model', 'plant', 'serial_id', 'vendor_id', 'vendor_name', 'deptid', 'dept_name', 'category', 'x_asset_status', 'asset_status', 'x_asset_reason', 'x_agreement_id', 'business_unit'];
    const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const dir = order === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push(`(asset_id LIKE ? OR tag_numbe LIKE ? OR descr LIKE ? OR descr_long LIKE ? OR serial_id LIKE ? OR vendor_name LIKE ? OR dept_name LIKE ? OR model LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s);
    }
    if (categories && categories.length > 0) {
      conditions.push(`category IN (${categories.map(() => '?').join(',')})`);
      params.push(...categories);
    }
    if (statuses && statuses.length > 0) {
      conditions.push(`asset_status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (departments && departments.length > 0) {
      conditions.push(`dept_name IN (${departments.map(() => '?').join(',')})`);
      params.push(...departments);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM assets ${where}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0].total;

    const safeLimit = Number(limit);
    const safeOffset = Number(offset);
    const sql = `SELECT * FROM assets ${where} ORDER BY ${sort} ${dir} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const [rows] = await pool.query(sql, params);

    return { rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  async getCategories() {
    const [rows] = await pool.query(`SELECT DISTINCT category FROM assets WHERE category IS NOT NULL AND category != '' ORDER BY category`);
    return rows.map(r => r.category);
  },

  async getStatuses() {
    const [rows] = await pool.query(`SELECT DISTINCT asset_status FROM assets WHERE asset_status IS NOT NULL AND asset_status != '' ORDER BY asset_status`);
    return rows.map(r => r.asset_status);
  },

  async getDepartments() {
    const [rows] = await pool.query(`SELECT DISTINCT dept_name FROM assets WHERE dept_name IS NOT NULL AND dept_name != '' ORDER BY dept_name`);
    return rows.map(r => r.dept_name);
  },

  async getSummary() {
    const sqls = {
      total: 'SELECT COUNT(*) as value FROM assets',
      byStatus: 'SELECT COALESCE(asset_status, "N/A") as label, COUNT(*) as value FROM assets GROUP BY asset_status ORDER BY value DESC LIMIT 5',
      byCategory: 'SELECT COALESCE(category, "N/A") as label, COUNT(*) as value FROM assets GROUP BY category ORDER BY value DESC LIMIT 5',
      byDept: 'SELECT COALESCE(dept_name, "N/A") as label, COUNT(*) as value FROM assets GROUP BY dept_name ORDER BY value DESC LIMIT 5'
    };

    const [total] = await pool.query(sqls.total);
    const [byStatus] = await pool.query(sqls.byStatus);
    const [byCategory] = await pool.query(sqls.byCategory);
    const [byDept] = await pool.query(sqls.byDept);

    return {
      total: total[0].value,
      byStatus,
      byCategory,
      byDept
    };
  },

  async bulkInsert(rows) {
    if (rows.length === 0) return { inserted: 0, skipped: 0, total: 0 };
    const sql = `INSERT IGNORE INTO assets (business_unit, asset_id, tag_numbe, descr, descr_long, model, plant, serial_id, vendor_id, vendor_name, deptid, dept_name, category, x_asset_status, asset_status, x_asset_reason, x_agreement_id) VALUES ?`;
    const batchSize = 500;
    let inserted = 0;
    const total = rows.length;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map(r => [
        r.business_unit || null,
        r.asset_id || null,
        r.tag_numbe || null,
        r.descr || null,
        r.descr_long || null,
        r.model || null,
        r.plant || null,
        r.serial_id || null,
        r.vendor_id || null,
        r.vendor_name || null,
        r.deptid || null,
        r.dept_name || null,
        r.category || null,
        r.x_asset_status || null,
        r.asset_status || null,
        r.x_asset_reason || null,
        r.x_agreement_id || null
      ]);
      const [result] = await pool.query(sql, [values]);
      inserted += result.affectedRows;
    }
    return { inserted, skipped: total - inserted, total };
  },

  async deleteAll() {
    const [result] = await pool.query('DELETE FROM assets');
    return result.affectedRows;
  }
};

module.exports = Asset;
