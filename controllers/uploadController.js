const path = require('path');
const fs = require('fs');
const Asset = require('../models/asset');
const ActivityLog = require('../models/activityLog');
const { ALL_COLUMNS, parseAssetExcel } = require('../helpers/excelParser');

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
    res.render('upload', { result: null, error: null, isWarning: false });
  },

  async handleUpload(req, res) {
    if (req.session.role === 'user') {
      return res.render('upload', { result: null, error: req.__('upload.error_no_permission_upload'), isWarning: false });
    }
    if (!req.file) {
      return res.render('upload', { result: null, error: req.__('upload.error_no_file'), isWarning: false });
    }

    const filePath = req.file.path;
    try {
      const parsed = parseAssetExcel(filePath);
      if (parsed.error) {
        return res.render('upload', { result: null, error: req.__('upload.error_process', parsed.error), isWarning: false });
      }

      const { rows, matchedCols, sheetName, sheetRef, headerRow } = parsed;

      const { inserted, skipped } = await Asset.bulkInsert(rows, req.session.userId);

      if (inserted > 0) {
        await ActivityLog.create({
          userId: req.session.userId,
          username: req.session.username,
          action: 'upload',
          module: 'asset',
          target: req.file.originalname,
          details: JSON.stringify({ inserted, skipped, rows: rows.length })
        });
      }

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
      let resultMsg = req.__('upload.result_imported', inserted, rows.length);
      const isWarning = inserted === 0 && skipped > 0;
      if (skipped > 0) resultMsg += ' ' + req.__('upload.result_skipped', skipped);

      res.render('upload', {
        result: resultMsg,
        isWarning: inserted === 0 && skipped > 0,
        info: {
          sheetRef: `${sheetName}: ${sheetRef}`,
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
      res.render('upload', { result: null, error: req.__('upload.error_process', err.message), isWarning: false });
    } finally {
      fs.unlink(filePath, () => {});
    }
  },

  async handleManualEntry(req, res) {
    if (req.session.role === 'user') {
      return res.render('upload', { result: null, error: req.__('upload.error_no_permission_add'), isWarning: false });
    }
    try {
      const row = mapFormRow(req.body);
      const { inserted } = await Asset.bulkInsert([row], req.session.userId);
      if (inserted === 0) {
        return res.render('upload', {
          result: req.__('upload.result_duplicate', row.asset_id),
          isWarning: true,
          info: null,
          error: null
        });
      }
      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'create',
        module: 'asset',
        target: row.asset_id,
        details: JSON.stringify({ source: 'manual' })
      });
      res.render('upload', {
        result: req.__('upload.result_added'),
        info: null,
        error: null,
        isWarning: false
      });
    } catch (err) {
      console.error('Manual entry error:', err);
      res.render('upload', { result: null, error: req.__('upload.error_process', err.message), info: null, isWarning: false });
    }
  }
};

module.exports = uploadController;
