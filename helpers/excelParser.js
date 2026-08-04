const XLSX = require('xlsx');

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

/**
 * Read an Excel file and map its rows to asset columns.
 * Returns { rows, matchedCols, sheetName, sheetRef, headerRow, colCount, error }
 */
const parseAssetExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  let bestSheet = null;
  let bestScore = -1;
  let bestName = '';

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const { score, colCount } = scoreSheet(sheet);
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
    return { error: 'File must have a header row and data row' };
  }

  const headerRow = rawRows[0];
  const dataRows = rawRows.slice(1);

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

  const rows = [];
  dataRows.forEach(rowCells => {
    const r = {};
    ALL_COLUMNS.forEach(col => {
      const idx = headerIndexMap[col];
      const val = idx !== undefined ? rowCells[idx] : undefined;
      r[col.toLowerCase()] = (val === '' || val === null || val === undefined) ? null : val;
    });
    if (r.asset_id !== null && r.asset_id !== undefined && String(r.asset_id).trim() !== '') {
      rows.push(r);
    }
  });

  return {
    rows,
    matchedCols,
    sheetName: bestName,
    sheetRef,
    headerRow,
    colCount: headerRow.length
  };
};

module.exports = {
  ALL_COLUMNS,
  ALIASES,
  normalizeHeader,
  resolveColumn,
  parseAssetExcel,
  scoreSheet
};
