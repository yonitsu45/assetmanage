const { pool } = require('../config/db');

const ALLOWED_SORT = ['asset_id', 'business_unit', 'tag_number', 'tag_number_extend', 'serial_number_asset', 'descr', 'descr_long', 'model', 'plant', 'serial_id', 'vendor_id', 'vendor_name', 'deptid', 'dept_name', 'category', 'category_name', 'x_asset_status', 'asset_status', 'x_asset_reason', 'x_agreement_id', 'expire_date', 'created_at', 'updated_at'];

const normalizeDate = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, 10);
};

function buildConditions({ search, categories, statuses, departments }) {
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push(`(asset_id LIKE ? OR tag_number LIKE ? OR tag_number_extend LIKE ? OR serial_number_asset LIKE ? OR descr LIKE ? OR descr_long LIKE ? OR serial_id LIKE ? OR vendor_id LIKE ? OR vendor_name LIKE ? OR dept_name LIKE ? OR category_name LIKE ? OR model LIKE ? OR business_unit LIKE ? OR expire_date LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s, s, s, s, s, s, s, s);
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
  return { conditions, params };
}

const Asset = {
  async getAll({ search, categories, statuses, departments, sortBy, order, page, limit }) {
    const offset = (page - 1) * limit;
    const sort = ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at';
    const dir = order === 'ASC' ? 'ASC' : 'DESC';

    const { conditions, params } = buildConditions({ search, categories, statuses, departments });
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

  async getAllForExport({ search, categories, statuses, departments, sortBy, order }) {
    const sort = ALLOWED_SORT.includes(sortBy) ? sortBy : 'asset_id';
    const dir = order === 'ASC' ? 'ASC' : 'DESC';

    const { conditions, params } = buildConditions({ search, categories, statuses, departments });
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM assets ${where} ORDER BY ${sort} ${dir}`;
    const [rows] = await pool.query(sql, params);
    return rows;
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

  async getSummary(departments) {
    const { conditions, params } = buildConditions({ departments });
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sqls = {
      total: `SELECT COUNT(*) as value FROM assets ${where}`,
      byStatus: `SELECT COALESCE(asset_status, "N/A") as label, COUNT(*) as value FROM assets ${where} GROUP BY asset_status ORDER BY value DESC LIMIT 5`,
      byCategory: `SELECT COALESCE(category, "N/A") as label, COUNT(*) as value FROM assets ${where} GROUP BY category ORDER BY value DESC LIMIT 5`,
      byDept: `SELECT COALESCE(dept_name, "N/A") as label, COUNT(*) as value FROM assets ${where} GROUP BY dept_name ORDER BY value DESC LIMIT 5`
    };

    const [total] = await pool.query(sqls.total, params);
    const [byStatus] = await pool.query(sqls.byStatus, params);
    const [byCategory] = await pool.query(sqls.byCategory, params);
    const [byDept] = await pool.query(sqls.byDept, params);

    return {
      total: total[0].value,
      byStatus,
      byCategory,
      byDept
    };
  },

  async bulkInsert(rows, uploaded_by) {
    if (rows.length === 0) return { inserted: 0, skipped: 0, total: 0 };
    const sql = `INSERT IGNORE INTO assets (business_unit, asset_id, tag_number, tag_number_extend, serial_number_asset, descr, descr_long, model, plant, serial_id, vendor_id, vendor_name, deptid, dept_name, category, category_name, x_asset_status, asset_status, x_asset_reason, x_agreement_id, expire_date, uploaded_by) VALUES ?`;
    const batchSize = 500;
    let inserted = 0;
    const total = rows.length;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map(r => [
        r.business_unit || null,
        r.asset_id || null,
        r.tag_number || null,
        r.tag_number_extend || null,
        r.serial_number_asset || null,
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
        r.category_name || null,
        r.x_asset_status || null,
        r.asset_status || null,
        r.x_asset_reason || null,
        r.x_agreement_id || null,
        normalizeDate(r.expire_date),
        uploaded_by || null
      ]);
      const [result] = await pool.query(sql, [values]);
      inserted += result.affectedRows;
    }
    return { inserted, skipped: total - inserted, total };
  },

  async getById(assetId) {
    const [rows] = await pool.query('SELECT * FROM assets WHERE asset_id = ?', [assetId]);
    return rows[0] || null;
  },

  async getByAssetIds(ids) {
    if (!ids || ids.length === 0) return new Map();
    const [rows] = await pool.query(`SELECT * FROM assets WHERE asset_id IN (${ids.map(() => '?').join(',')})`, ids);
    const map = new Map();
    rows.forEach(r => map.set(r.asset_id, r));
    return map;
  },

  async deleteAll() {
    const [result] = await pool.query('DELETE FROM assets');
    return result.affectedRows;
  },

  async update(assetId, data, updatedBy) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`\`${key}\` = ?`);
      params.push(value === '' ? null : value);
    }
    if (fields.length === 0) return 0;
    fields.push('updated_at = NOW()');
    fields.push('updated_by = ?');
    params.push(updatedBy || null);
    params.push(assetId);
    const sql = `UPDATE assets SET ${fields.join(', ')} WHERE asset_id = ?`;
    const [result] = await pool.query(sql, params);
    return result.affectedRows;
  },

  async deleteById(assetId) {
    const [result] = await pool.query('DELETE FROM assets WHERE asset_id = ?', [assetId]);
    return result.affectedRows;
  },

  async bulkUpdateStatus(ids, status, updatedBy) {
    if (!ids || ids.length === 0) return 0;
    const sql = `UPDATE assets SET asset_status = ?, updated_at = NOW(), updated_by = ? WHERE asset_id IN (${ids.map(() => '?').join(',')})`;
    const [result] = await pool.query(sql, [status, updatedBy || null, ...ids]);
    return result.affectedRows;
  },

  async bulkTransferDepartment(ids, deptName, updatedBy) {
    if (!ids || ids.length === 0) return 0;
    const sql = `UPDATE assets SET dept_name = ?, updated_at = NOW(), updated_by = ? WHERE asset_id IN (${ids.map(() => '?').join(',')})`;
    const [result] = await pool.query(sql, [deptName, updatedBy || null, ...ids]);
    return result.affectedRows;
  }
};

module.exports = Asset;
