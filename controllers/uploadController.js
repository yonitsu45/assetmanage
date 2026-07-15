const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Asset = require('../models/asset');

const ALL_COLUMNS = [
  'BUSINESS_UNIT', 'ASSET_ID', 'TAG_NUMBE', 'DESCR', 'DESCR_LONG',
  'MODEL', 'PLANT', 'SERIAL_ID', 'VENDOR_ID', 'VENDOR_NAME',
  'DEPTID', 'DEPT_NAME', 'CATEGORY', 'X_ASSET_STATUS', 'ASSET_STATUS',
  'X_ASSET_REASON', 'X_AGREEMENT_ID'
];

const ALIASES = {
  'TAG_NUMBER': 'TAG_NUMBE',
  'DESCRIPTION': 'DESCR',
  'LONG_DESCRIPTION': 'DESCR_LONG',
  'LONG_DESC': 'DESCR_LONG',
  'SERIAL_NUMBER': 'SERIAL_ID',
  'SERIAL_NO': 'SERIAL_ID',
  'DEPT_ID': 'DEPTID',
  'DEPARTMENT_ID': 'DEPTID',
  'DEPARTMENT': 'DEPT_NAME',
  'VENDOR': 'VENDOR_NAME',
  'ASSETSTATUS': 'ASSET_STATUS',
  'STATUS': 'ASSET_STATUS',
  'XSTATUS': 'X_ASSET_STATUS',
  'REASON': 'X_ASSET_REASON',
  'AGREEMENT_ID': 'X_AGREEMENT_ID',
  'BUSINESSUNIT': 'BUSINESS_UNIT',
  'ASSETID': 'ASSET_ID',
  'ASSET': 'ASSET_ID'
};

const normalizeHeader = (h) => {
  if (!h) return '';
  return h.toString().trim().toUpperCase().replace(/[\s\-]+/g, '_').replace(/[^A-Z0-9_]/g, '');
};

const resolveColumn = (normalized) => {
  if (ALL_COLUMNS.includes(normalized)) return normalized;
  return ALIASES[normalized] || null;
};

/** Score a sheet by how many of its header columns match our expected columns */
const scoreSheet = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows || rows.length < 1) return { score: -1, colCount: 0, rowCount: 0, rows };
  const headers = rows[0];
  let matchCount = 0;
  for (const h of headers) {
    const name = h ? h.toString().trim() : '';
    if (!name) continue;
    const norm = normalizeHeader(name);
    if (resolveColumn(norm)) matchCount++;
  }
  const ref = sheet['!ref'];
  const colCount = ref ? XLSX.utils.decode_range(ref).e.c + 1 : headers.length;
  return { score: matchCount, colCount, rowCount: rows.length, rows };
};

const mapFormRow = (body) => {
  const r = {};
  ALL_COLUMNS.forEach(col => {
    const val = body[col.toLowerCase()];
    r[col.toLowerCase()] = (val === '' || val === null || val === undefined) ? null : val;
  });
  return r;
};

const uploadController = {
  showUpload(req, res) {
    res.render('upload', { result: null, error: null });
  },

  async handleUpload(req, res) {
    if (!req.file) {
      return res.render('upload', { result: null, error: 'กรุณาเลือกไฟล์ที่ต้องการอัปโหลด' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      // Score all sheets and pick the best one
      let bestSheet = null;
      let bestScore = -1;
      let bestName = '';
      const sheetScores = [];

      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const { score, colCount, rowCount, rows } = scoreSheet(sheet);
        sheetScores.push({ name, score, colCount, rowCount });
        console.log(`Sheet "${name}": score=${score} cols=${colCount} rows=${rowCount}`);
        if (score > bestScore || (score === bestScore && colCount > (bestSheet ? XLSX.utils.decode_range(bestSheet['!ref'] || 'A1:A1').e.c + 1 : 0))) {
          bestScore = score;
          bestSheet = sheet;
          bestName = name;
        }
      }

      if (!bestSheet) {
        bestSheet = workbook.Sheets[sheetNames[0]];
        bestName = sheetNames[0];
      }

      const rawRows = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: '' });
      const sheetRef = bestSheet['!ref'] || 'unknown';

      if (!rawRows || rawRows.length < 2) {
        return res.render('upload', { result: null, error: 'File must have at least a header row and one data row' });
      }

      const headerRow = rawRows[0];
      const dataRows = rawRows.slice(1);

      // Build header list and mapping
      const headerMap = {};
      const matchedCols = [];
      const headerIndexMap = {};

      headerRow.forEach((h, i) => {
        const name = h ? h.toString().trim() : '';
        if (!name) return;
        const norm = normalizeHeader(name);
        const resolved = resolveColumn(norm);
        if (resolved) {
          headerMap[resolved] = name;
          headerIndexMap[resolved] = i;
          if (!matchedCols.includes(resolved)) matchedCols.push(resolved);
        }
      });

      // Positional fallback
      if (matchedCols.length < 3 && dataRows.length > 0 && dataRows[0].length >= 14) {
        const posColumns = ['BUSINESS_UNIT', 'ASSET_ID', 'TAG_NUMBER', 'DESCR', 'DESCR_LONG', 'MODEL', 'PLANT', 'SERIAL_ID', 'VENDOR_ID', 'VENDOR_NAME', 'DEPTID', 'DEPT_NAME', 'CATEGORY', 'X_ASSET_STATUS', 'ASSET_STATUS', 'X_ASSET_REASON', 'X_AGREEMENT_ID'];
        matchedCols.length = 0;
        posColumns.forEach((col, i) => {
          const resolved = resolveColumn(normalizeHeader(col));
          if (resolved) {
            headerIndexMap[resolved] = i;
            headerMap[resolved] = col;
            matchedCols.push(resolved);
          }
        });
      }

      // Build rows from raw data
      const rows = [];
      dataRows.forEach(rowCells => {
        const r = {};
        ALL_COLUMNS.forEach(col => {
          const idx = headerIndexMap[col];
          const val = idx !== undefined ? rowCells[idx] : undefined;
          r[col.toLowerCase()] = (val === '' || val === null || val === undefined) ? null : val;
        });
        rows.push(r);
      });

      const { inserted, skipped } = await Asset.bulkInsert(rows);

      const rawHeaders = headerRow.length === 0 ? '(no headers)' : headerRow.map((c, i) => `[${i}] ${c || '(blank)'}`).join(' | ');
      const mappedNames = matchedCols.length > 0 ? matchedCols.join(', ') : '(none)';
      const unmapped = ALL_COLUMNS.filter(col => !matchedCols.includes(col)).join(', ');
      let sampleRow = '';
      if (rows.length > 0) {
        const r = rows[0];
        const sampleParts = [];
        for (const col of ALL_COLUMNS) {
          const val = r[col.toLowerCase()];
          sampleParts.push(`${col}=${val !== null ? val : '(empty)'}`);
        }
        sampleRow = sampleParts.join(', ');
      }

      const colCount = headerRow.length;
      let resultMsg = `นำเข้าข้อมูล ${inserted} จาก ${rows.length} รายการ`;
      const isWarning = inserted === 0 && skipped > 0;
      if (skipped > 0) resultMsg += ` (ข้าม ${skipped} รายการ — asset_id ซ้ำ)`;

      res.render('upload', {
        result: resultMsg,
        isWarning: inserted === 0 && skipped > 0,
        info: {
          sheetRef: `${bestName}: ${sheetRef}`,
          colCount,
          rawHeaders,
          mapped: mappedNames,
          unmapped: unmapped || '(none - all matched)',
          sample: sampleRow
        },
        error: null
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.render('upload', { result: null, error: 'Failed to process file: ' + err.message });
    } finally {
      fs.unlink(filePath, () => {});
    }
  },

  async handleManualEntry(req, res) {
    try {
      const row = mapFormRow(req.body);
      const { inserted } = await Asset.bulkInsert([row]);
      if (inserted === 0) {
        return res.render('upload', {
          result: null,
          error: `Asset ID "${row.asset_id}" already exists`
        });
      }
      res.render('upload', {
        result: 'Asset added successfully',
        info: null,
        error: null
      });
    } catch (err) {
      console.error('Manual entry error:', err);
      res.render('upload', { result: null, error: 'Failed to add asset: ' + err.message });
    }
  }
};

module.exports = uploadController;
