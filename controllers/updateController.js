const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Asset = require('../models/asset');
const ActivityLog = require('../models/activityLog');
const { ALL_COLUMNS, parseAssetExcel } = require('../helpers/excelParser');

const previewsDir = path.join(__dirname, '..', 'previews');
if (!fs.existsSync(previewsDir)) {
  fs.mkdirSync(previewsDir, { recursive: true });
}

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

const previewFilePath = (token) => path.join(previewsDir, token + '.json');

const loadPreview = (token) => {
  const file = previewFilePath(token);
  if (!token || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return null;
  }
};

const deletePreview = (token) => {
  if (!token) return;
  fs.unlink(previewFilePath(token), () => {});
};

const cleanupOldPreviews = () => {
  const cutoff = Date.now() - PREVIEW_TTL_MS;
  let files;
  try {
    files = fs.readdirSync(previewsDir);
  } catch (err) {
    return;
  }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const st = fs.statSync(path.join(previewsDir, f));
      if (st.mtimeMs < cutoff) fs.unlinkSync(path.join(previewsDir, f));
    } catch (err) {}
  }
};

const COMPARE_COLUMNS = ALL_COLUMNS.filter(col => col !== 'ASSET_ID').map(col => col.toLowerCase());

const normalizeValue = (v) => {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

const COLUMN_LABEL_KEYS = {
  business_unit: 'dashboard.table.business_unit',
  tag_number: 'dashboard.table.tag_number',
  tag_number_extend: 'dashboard.table.tag_number_extend',
  serial_number_asset: 'dashboard.table.serial_number_asset',
  descr: 'dashboard.table.descr',
  descr_long: 'dashboard.table.descr_long',
  model: 'dashboard.table.model',
  plant: 'dashboard.table.plant',
  serial_id: 'dashboard.table.serial_id',
  vendor_id: 'dashboard.table.vendor_id',
  vendor_name: 'dashboard.table.vendor_name',
  deptid: 'dashboard.table.deptid',
  dept_name: 'dashboard.table.dept_name',
  category: 'dashboard.table.category',
  category_name: 'dashboard.table.category_name',
  x_asset_status: 'dashboard.table.x_asset_status',
  asset_status: 'dashboard.table.asset_status',
  x_asset_reason: 'dashboard.table.x_asset_reason',
  x_agreement_id: 'dashboard.table.x_agreement_id'
};

const updateController = {
  show(req, res) {
    res.render('update', { step: 'form', error: null, result: null, preview: null, query: req.query });
  },

  async preview(req, res) {
    if (!req.file) {
      return res.render('update', { step: 'form', error: req.__('update.error_no_file'), result: null, preview: null, query: req.query });
    }

    const filePath = req.file.path;
    try {
      const parsed = parseAssetExcel(filePath);
      if (parsed.error) {
        return res.render('update', { step: 'form', error: req.__('upload.error_process', parsed.error), result: null, preview: null, query: req.query });
      }

      const existingMap = await Asset.getByAssetIds(parsed.rows.map(r => String(r.asset_id)));

      const previewRows = parsed.rows.map((row, index) => {
        const assetId = String(row.asset_id);
        const existing = existingMap.get(assetId);

        if (!existing) {
          return {
            key: index,
            assetId,
            status: 'new',
            row,
            diff: []
          };
        }

        const diff = [];
        for (const col of COMPARE_COLUMNS) {
          const oldVal = normalizeValue(existing[col]);
          const newVal = normalizeValue(row[col]);
          if (oldVal !== newVal) {
            diff.push({ col, labelKey: COLUMN_LABEL_KEYS[col], old: existing[col], new: row[col] });
          }
        }

        return {
          key: index,
          assetId,
          status: diff.length === 0 ? 'unchanged' : 'changed',
          row,
          diff
        };
      });

      const changed = previewRows.filter(r => r.status === 'changed');
      const unchanged = previewRows.filter(r => r.status === 'unchanged');
      const toCreate = previewRows.filter(r => r.status === 'new');

      const token = crypto.randomUUID();
      fs.writeFileSync(previewFilePath(token), JSON.stringify({
        rows: previewRows,
        filename: req.file.originalname,
        createdAt: Date.now()
      }));
      req.session.updatePreviewToken = token;
      cleanupOldPreviews();

      res.render('update', {
        step: 'preview',
        error: null,
        result: null,
        query: req.query,
        preview: {
          rows: previewRows,
          changed,
          unchanged,
          toCreate,
          filename: req.file.originalname,
          parsed
        }
      });
    } catch (err) {
      console.error('Update preview error:', err);
      res.render('update', { step: 'form', error: req.__('upload.error_process', err.message), result: null, preview: null, query: req.query });
    } finally {
      fs.unlink(filePath, () => {});
    }
  },

  async apply(req, res) {
    const pending = loadPreview(req.session.updatePreviewToken);
    if (!pending || !pending.rows) {
      return res.render('update', { step: 'form', error: req.__('update.error_session'), result: null, preview: null, query: req.query });
    }

    let updated = 0;
    let added = 0;
    const userId = req.session.userId;
    const username = req.session.username;

    try {
      for (const item of pending.rows) {
        if (item.status === 'changed') {
          const data = {};
          for (const d of item.diff) {
            const choice = req.body[`choice_${item.key}_${d.col}`];
            if (choice === 'new') {
              data[d.col] = item.row[d.col] === undefined ? null : item.row[d.col];
            }
          }
          if (Object.keys(data).length > 0) {
            await Asset.update(item.assetId, data, userId);
            updated++;
            await ActivityLog.create({
              userId,
              username,
              action: 'update',
              module: 'asset',
              target: item.assetId,
              details: JSON.stringify({ source: 'update', fields: Object.keys(data) })
            });
          }
        } else if (item.status === 'new') {
          if (req.body[`include_${item.key}`]) {
            const { inserted } = await Asset.bulkInsert([item.row], userId);
            if (inserted > 0) {
              added++;
              await ActivityLog.create({
                userId,
                username,
                action: 'create',
                module: 'asset',
                target: item.assetId,
                details: JSON.stringify({ source: 'update' })
              });
            }
          }
        }
      }

      deletePreview(req.session.updatePreviewToken);
      req.session.updatePreviewToken = null;
      res.render('update', {
        step: 'form',
        error: null,
        result: { updated, added, unchanged: pending.rows.filter(r => r.status === 'unchanged').length },
        preview: null,
        query: req.query
      });
    } catch (err) {
      console.error('Update apply error:', err);
      res.render('update', { step: 'form', error: req.__('update.error_apply'), result: null, preview: null, query: req.query });
    }
  },

  cancel(req, res) {
    deletePreview(req.session.updatePreviewToken);
    req.session.updatePreviewToken = null;
    res.redirect('/update');
  }
};

module.exports = updateController;
