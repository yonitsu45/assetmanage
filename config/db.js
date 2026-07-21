const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asset_management',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.on('connection', (conn) => {
  conn.query("SET NAMES utf8mb4", (err) => {
    if (err) console.error('SET NAMES utf8mb4 failed:', err);
  });
});

const initDB = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4'
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'asset_management'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100),
      role VARCHAR(20) DEFAULT 'user',
      department VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migrate existing table if columns don't exist
  try { await pool.query(`ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' AFTER full_name`); } catch (e) {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN department VARCHAR(100) AFTER role`); } catch (e) {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) AFTER full_name`); } catch (e) {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assets (
      asset_id VARCHAR(100) NOT NULL,
      business_unit VARCHAR(100),
      tag_numbe VARCHAR(100),
      descr VARCHAR(255),
      descr_long TEXT,
      model VARCHAR(100),
      plant VARCHAR(100),
      serial_id VARCHAR(100),
      vendor_id VARCHAR(100),
      vendor_name VARCHAR(255),
      deptid VARCHAR(100),
      dept_name VARCHAR(255),
      category VARCHAR(100),
      x_asset_status VARCHAR(100),
      asset_status VARCHAR(100),
      x_asset_reason VARCHAR(255),
      x_agreement_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (asset_id),
      INDEX idx_tag_numbe (tag_numbe),
      INDEX idx_serial_id (serial_id),
      INDEX idx_category (category),
      INDEX idx_asset_status (asset_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migrate existing table if needed
  try {
    await pool.query(`ALTER TABLE assets DROP PRIMARY KEY, DROP COLUMN id, ADD PRIMARY KEY (asset_id)`);
  } catch (e) {
    // Table might already be in the new format — ignore error
  }

  try { await pool.query(`ALTER TABLE assets ADD COLUMN uploaded_by INT AFTER x_agreement_id`); } catch (e) {}
  try { await pool.query(`ALTER TABLE assets ADD FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL`); } catch (e) {}


  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      filepath VARCHAR(500) NOT NULL,
      filesize INT NOT NULL DEFAULT 0,
      uploaded_by INT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try { await pool.query(`ALTER TABLE documents CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } catch (e) {}
  try { await pool.query(`ALTER TABLE documents ADD COLUMN department VARCHAR(100) AFTER uploaded_by`); } catch (e) {}

  try { await pool.query(`UPDATE users SET role = 'super_admin' WHERE role = 'admin'`); } catch (e) {}

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [existing] = await pool.query('SELECT COUNT(*) AS cnt FROM departments');
    if (existing[0].cnt === 0) {
      const [depts] = await pool.query('SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != \'\'');
      for (const d of depts) {
        await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [d.department]);
      }
    }
  } catch (e) {}
};

module.exports = { pool, initDB };
