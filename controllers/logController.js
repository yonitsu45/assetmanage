const ActivityLog = require('../models/activityLog');
const Asset = require('../models/asset');

const FIELD_LABELS = {
  business_unit: 'business_unit',
  tag_number: 'tag_number',
  tag_number_extend: 'tag_number_extend',
  serial_number_asset: 'serial_number_asset',
  descr: 'descr',
  descr_long: 'descr_long',
  model: 'model',
  plant: 'plant',
  serial_id: 'serial_id',
  vendor_id: 'vendor_id',
  vendor_name: 'vendor_name',
  deptid: 'deptid',
  dept_name: 'dept_name',
  category: 'category',
  category_name: 'category_name',
  x_asset_status: 'x_asset_status',
  asset_status: 'asset_status',
  x_asset_reason: 'x_asset_reason',
  x_agreement_id: 'x_agreement_id'
};

function parseDetails(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function fieldLabel(__, field) {
  const label = FIELD_LABELS[field] ? `dashboard.table.${field}` : null;
  if (label) {
    const translated = __(label);
    if (translated !== label) return translated;
  }
  return field;
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function joinValues(__, arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(String).join(__('logs.humanized.list_sep'));
}

function humanizeLog(__, log) {
  const d = parseDetails(log.details);
  const key = `${log.module}:${log.action}`;

  if (key === 'asset:clear' && d) return __('logs.humanized.clear', d.deleted);
  if (key === 'asset:create' && log.target) return __('logs.humanized.create_asset', log.target);
  if (key === 'asset:delete' && log.target) {
    const extra = d && (d.descr || d.dept_name) ? ` (${joinValues(__, [d.descr, d.dept_name].filter(Boolean))})` : '';
    return __('logs.humanized.delete_asset', log.target) + extra;
  }
  if (key === 'asset:update' && log.target && d) {
    const fields = (d.fields || []).map(f => fieldLabel(__, f));
    return __('logs.humanized.update_asset', log.target, fields.join(__('logs.humanized.list_sep')));
  }
  if (key === 'asset:export' && d) {
    let filterText = '';
    const parts = [];
    if (d.filters && d.filters.search) parts.push(__('logs.humanized.export_search', d.filters.search));
    if (d.filters && d.filters.categories && d.filters.categories.length) parts.push(__('logs.humanized.export_categories', d.filters.categories.length));
    if (d.filters && d.filters.statuses && d.filters.statuses.length) parts.push(__('logs.humanized.export_statuses', d.filters.statuses.length));
    if (d.filters && d.filters.departments && d.filters.departments.length) parts.push(__('logs.humanized.export_departments', d.filters.departments.length));
    if (parts.length) filterText = ` (${parts.join(', ')})`;
    return __('logs.humanized.export', d.count) + filterText;
  }
  if (key === 'asset:bulk_status' && d) return __('logs.humanized.bulk_status', d.count, d.status);
  if (key === 'asset:transfer' && d) {
    let text = __('logs.humanized.transfer', d.count, d.to_dept);
    if (d.note) text += ` (${__('logs.humanized.transfer_note', d.note)})`;
    return text;
  }
  if (key === 'asset:upload' && log.target && d) {
    return __('logs.humanized.upload_asset', d.rows || d.inserted || 0, log.target, d.inserted, d.skipped || 0);
  }
  if (key === 'document:upload' && log.target && d) {
    const size = formatBytes(d.filesize);
    return __('logs.humanized.upload_document', log.target) + (size ? ` (${size})` : '');
  }
  if (key === 'document:delete' && log.target) {
    return __('logs.humanized.delete_document', log.target);
  }
  if (log.details) return String(log.details);
  return '';
}

const logController = {
  async index(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 25;
      const module = req.query.module || '';
      const action = req.query.action || '';
      const search = req.query.search || '';

      const data = await ActivityLog.list({ page, limit, module, action, search });
      const modules = await ActivityLog.getModules();
      const actions = await ActivityLog.getActions();

      const logs = data.rows.map(log => {
        const d = parseDetails(log.details);
        return {
          ...log,
          summary: humanizeLog(req.__, log),
          canViewItems: !!(d && Array.isArray(d.asset_ids) && d.asset_ids.length > 0)
        };
      });

      res.render('logs', {
        logs,
        modules,
        actions,
        module,
        action,
        search,
        page: data.page,
        totalPages: data.totalPages,
        total: data.total,
        limit
      });
    } catch (err) {
      console.error('Logs error:', err);
      res.status(500).send('Server error');
    }
  },

  async detail(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (!id) return res.status(404).send('Not found');
      const log = await ActivityLog.getById(id);
      if (!log) return res.status(404).send('Not found');

      const d = parseDetails(log.details);
      let items = [];
      let info = {};
      if (log.module === 'asset' && (log.action === 'bulk_status' || log.action === 'transfer') && d && Array.isArray(d.asset_ids)) {
        const map = await Asset.getByAssetIds(d.asset_ids);
        items = d.asset_ids.map(id => {
          const asset = map.get(id) || null;
          return {
            asset_id: id,
            descr: asset ? asset.descr : null,
            status: asset ? asset.asset_status : null,
            exists: !!asset
          };
        });
        info = {
          status: d.status || null,
          to_dept: d.to_dept || null,
          count: d.count || items.length,
          note: d.note || null
        };
      }

      res.render('log-detail', { log, items, info });
    } catch (err) {
      console.error('Log detail error:', err);
      res.status(500).send('Server error');
    }
  }
};

module.exports = logController;
