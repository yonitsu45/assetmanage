const XLSX = require('xlsx');

const ALL_COLUMNS = [
  'BUSINESS_UNIT', 'ASSET_ID', 'TAG_NUMBER', 'SERIAL_NUMBER_ASSET', 'TAG_NUMBER_EXTEND',
  'DESCR', 'DESCR_LONG', 'MODEL', 'PLANT', 'SERIAL_ID',
  'VENDOR_ID', 'VENDOR_NAME', 'DEPTID', 'DEPT_NAME', 'CATEGORY', 'CATEGORY_NAME',
  'X_ASSET_STATUS', 'ASSET_STATUS', 'X_ASSET_REASON', 'X_AGREEMENT_ID', 'EXPIRE_DATE'
];

const OPTIONAL_ASSET_COLUMNS = ['DESCR_LONG', 'MODEL', 'PLANT', 'SERIAL_ID', 'X_ASSET_REASON', 'EXPIRE_DATE'];
const REQUIRED_ASSET_COLUMNS = ALL_COLUMNS.filter(col => !OPTIONAL_ASSET_COLUMNS.includes(col));

const getMissingRequired = (row) => {
  const missing = [];
  for (const col of REQUIRED_ASSET_COLUMNS) {
    const key = col.toLowerCase();
    const v = row[key];
    if (v === null || v === undefined || String(v).trim() === '') missing.push(col);
  }
  return missing;
};

const ALIASES = {
  'TAG_NUMBE': 'TAG_NUMBER',
  'TAG_NUMBE_EXTEND': 'TAG_NUMBER_EXTEND',
  'TAG_NO': 'TAG_NUMBER',
  'TAG_EXTEND': 'TAG_NUMBER_EXTEND',
  'TAGNUMBER': 'TAG_NUMBER',
  'DESCRIPTION': 'DESCR',
  'LONG_DESCRIPTION': 'DESCR_LONG',
  'LONG_DESC': 'DESCR_LONG',
  'SERIAL_NUMBER': 'SERIAL_ID',
  'SERIAL_NO': 'SERIAL_ID',
  'SERIAL': 'SERIAL_ID',
  'DEPT_ID': 'DEPTID',
  'DEPARTMENT_ID': 'DEPTID',
  'DEPARTMENT': 'DEPT_NAME',
  'VENDOR': 'VENDOR_NAME',
  'ASSETSTATUS': 'ASSET_STATUS',
  'STATUS': 'ASSET_STATUS',
  'XSTATUS': 'X_ASSET_STATUS',
  'REASON': 'X_ASSET_REASON',
  'AGREEMENT_ID': 'X_AGREEMENT_ID',
  'EXPIRY_DATE': 'EXPIRE_DATE',
  'EXPIRED_DATE': 'EXPIRE_DATE',
  'INSURANCE_EXPIRY': 'EXPIRE_DATE',
  'INSURANCE_EXPIRY_DATE': 'EXPIRE_DATE',
  'INSURANCE_DATE': 'EXPIRE_DATE',
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
  if (matchedCols.length < 3 && dataRows.length > 0 && dataRows[0].length >= 20) {
    const posColumns = ['BUSINESS_UNIT', 'ASSET_ID', 'TAG_NUMBER', 'SERIAL_NUMBER_ASSET', 'TAG_NUMBER_EXTEND', 'DESCR', 'DESCR_LONG', 'MODEL', 'PLANT', 'SERIAL_ID', 'VENDOR_ID', 'VENDOR_NAME', 'DEPTID', 'DEPT_NAME', 'CATEGORY', 'CATEGORY_NAME', 'X_ASSET_STATUS', 'ASSET_STATUS', 'X_ASSET_REASON', 'X_AGREEMENT_ID'];
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

const DEPT_COL_ALIASES = {
  'COSTCENTER': 'costcenter',
  'COST_CENTER': 'costcenter',
  'DEPT_ID': 'costcenter',
  'DEPTID': 'costcenter',
  'CODE': 'costcenter',
  'DESCRIPTION': 'name',
  'DESCR': 'name',
  'DEPT_NAME': 'name',
  'NAME': 'name'
};

const CATEGORY_COL_ALIASES = {
  'CATEGORY': 'code',
  'CATEGORY_ID': 'code',
  'CATEGORYID': 'code',
  'CATEGORY_CODE': 'code',
  'CATEGORY_NAME': 'name',
  'NAME': 'name',
  'DESCRIPTION': 'name',
  'DESCR': 'name'
};

const resolveDeptColumn = (normalized) => {
  if (normalized === 'COSTCENTER') return 'costcenter';
  if (normalized === 'DESCRIPTION') return 'name';
  return DEPT_COL_ALIASES[normalized] || null;
};

const resolveCategoryColumn = (normalized) => CATEGORY_COL_ALIASES[normalized] || null;

const MAX_HEADER_SCAN_ROWS = 10;

const findHeaderRow = (rawRows, resolver, requiredFields) => {
  if (!rawRows || rawRows.length < 1) return null;
  const scanLimit = Math.min(rawRows.length, MAX_HEADER_SCAN_ROWS);
  for (let r = 0; r < scanLimit; r++) {
    const rowCells = rawRows[r];
    if (!rowCells || rowCells.length === 0) continue;
    const found = {};
    rowCells.forEach((h, i) => {
      const norm = normalizeHeader(h);
      const resolved = resolver(norm);
      if (resolved && found[resolved] === undefined) found[resolved] = i;
    });
    const missing = requiredFields.filter(f => found[f] === undefined);
    if (missing.length === 0) {
      return { headerIndex: r, indexes: found };
    }
  }
  return null;
};

const findDeptHeaderRow = (rawRows) => findHeaderRow(rawRows, resolveDeptColumn, ['costcenter', 'name']);

const findCategoryHeaderRow = (rawRows) => findHeaderRow(rawRows, resolveCategoryColumn, ['code', 'name']);

const parseDepartmentExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  const rows = [];
  const skippedSheets = [];
  let skippedRows = 0;

  const rawRowsList = [];
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    rawRowsList.push({ name, rawRows });
  }

  for (const { name, rawRows } of rawRowsList) {
    if (!rawRows || rawRows.length < 1) {
      skippedSheets.push(name);
      continue;
    }

    const header = findDeptHeaderRow(rawRows);
    if (!header) {
      skippedSheets.push(name);
      continue;
    }

    rawRows.slice(header.headerIndex + 1).forEach(rowCells => {
      const costRaw = rowCells[header.indexes.costcenter];
      const nameRaw = rowCells[header.indexes.name];
      const cost = costRaw === null || costRaw === undefined ? '' : String(costRaw).trim();
      const nm = nameRaw === null || nameRaw === undefined ? '' : String(nameRaw).trim();
      if (!cost || !nm) {
        skippedRows++;
        return;
      }
      rows.push({ costcenter: cost, name: nm });
    });
  }

  const seen = new Map();
  rows.forEach(r => { seen.set(r.costcenter, r); });
  const uniqueRows = Array.from(seen.values());

  return {
    rows: uniqueRows,
    skippedSheets,
    skippedRows,
    totalSheets: sheetNames.length
  };
};

const parseCategoryExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  const rows = [];
  const skippedSheets = [];
  let skippedRows = 0;

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 1) {
      skippedSheets.push(name);
      continue;
    }

    const header = findCategoryHeaderRow(rawRows);
    if (!header) {
      skippedSheets.push(name);
      continue;
    }

    rawRows.slice(header.headerIndex + 1).forEach(rowCells => {
      const codeRaw = rowCells[header.indexes.code];
      const nameRaw = rowCells[header.indexes.name];
      const code = codeRaw === null || codeRaw === undefined ? '' : String(codeRaw).trim();
      const nm = nameRaw === null || nameRaw === undefined ? '' : String(nameRaw).trim();
      if (!code || !nm) {
        skippedRows++;
        return;
      }
      rows.push({ code, name: nm });
    });
  }

  const seen = new Map();
  rows.forEach(r => { seen.set(r.code, r); });
  const uniqueRows = Array.from(seen.values());

  return {
    rows: uniqueRows,
    skippedSheets,
    skippedRows,
    totalSheets: sheetNames.length
  };
};

module.exports = {
  ALL_COLUMNS,
  ALIASES,
  REQUIRED_ASSET_COLUMNS,
  getMissingRequired,
  normalizeHeader,
  resolveColumn,
  parseAssetExcel,
  parseDepartmentExcel,
  parseCategoryExcel,
  scoreSheet
};
