const path = require('path');
const fs = require('fs');
const Asset = require('../models/asset');
const ActivityLog = require('../models/activityLog');
const { ALL_COLUMNS, parseAssetExcel, getMissingRequired } = require('../helpers/excelParser');

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

      const validRows = [];
      const invalidRows = [];
      for (const r of rows) {
        const missing = getMissingRequired(r);
        if (missing.length === 0) {
          validRows.push(r);
        } else {
          invalidRows.push({ asset_id: r.asset_id, missing });
        }
      }

      const { inserted, skipped } = await Asset.bulkInsert(validRows, req.session.userId);

      if (inserted > 0) {
        await ActivityLog.create({
          userId: req.session.userId,
          username: req.session.username,
          action: 'upload',
          module: 'asset',
          target: req.file.originalname,
          details: JSON.stringify({ inserted, skipped, rows: rows.length, invalidRows: invalidRows.length })
        });
      }

      let resultMsg = req.__('upload.result_imported', inserted, validRows.length);
      const isWarning = inserted === 0 && (skipped > 0 || invalidRows.length > 0);
      if (skipped > 0) resultMsg += ' ' + req.__('upload.result_skipped', skipped);
      if (invalidRows.length > 0) resultMsg += ' ' + req.__('upload.result_skipped_required', invalidRows.length);

      const missingSummary = {};
      invalidRows.forEach(r => r.missing.forEach(m => {
        missingSummary[m] = (missingSummary[m] || 0) + 1;
      }));

      res.render('upload', {
        result: resultMsg,
        isWarning,
        invalid: {
          rows: invalidRows,
          summary: missingSummary,
          sample: invalidRows.slice(0, 3).map(r => `${r.asset_id || '(no id)'} (${r.missing.join(', ')})`)
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
      const missing = getMissingRequired(row);
      if (missing.length > 0) {
        return res.render('upload', {
          result: req.__('upload.error_missing_required', missing.join(', ')),
          isWarning: true,
          error: null
        });
      }
      const { inserted } = await Asset.bulkInsert([row], req.session.userId);
      if (inserted === 0) {
        return res.render('upload', {
          result: req.__('upload.result_duplicate', row.asset_id),
          isWarning: true,
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
        error: null,
        isWarning: false
      });
    } catch (err) {
      console.error('Manual entry error:', err);
      res.render('upload', { result: null, error: req.__('upload.error_process', err.message), isWarning: false });
    }
  }
};

module.exports = uploadController;
