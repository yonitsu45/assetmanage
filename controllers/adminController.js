const bcrypt = require('bcrypt');
const fs = require('fs');
const User = require('../models/user');
const Department = require('../models/department');
const Category = require('../models/category');
const ActivityLog = require('../models/activityLog');
const { parseDepartmentExcel, parseCategoryExcel } = require('../helpers/excelParser');
const SALT_ROUNDS = 10;

const adminController = {
  async index(req, res) {
    try {
      const sortBy = req.query.sort_by || 'created_at';
      const order = req.query.order || 'DESC';
      const users = await User.getAll({ sortBy, order });
      const departments = await Department.getAll();
      const categories = await Category.getAll();
      res.render('admin-users', { users, departments, categories, error: null, success: null, reqQuery: req.query, sortBy, order });
    } catch (err) {
      console.error('Admin user list error:', err);
      res.status(500).send('Server error');
    }
  },

  async edit(req, res) {
    try {
      const { id } = req.params;
      const { username, email, full_name, role, department } = req.body;
      const userId = req.session.userId;

      if (parseInt(id) === parseInt(userId) && role !== undefined && role !== req.session.role) {
        return res.redirect('/admin/users?error=cannot_change_own_role');
      }

      const data = {};
      if (username !== undefined) data.username = username;
      if (email !== undefined) data.email = email;
      if (full_name !== undefined) data.full_name = full_name;
      if (role !== undefined) data.role = role;
      if (department !== undefined) data.department = department === '' ? null : department;
      await User.update(id, data);
      res.redirect('/admin/users?success=updated');
    } catch (err) {
      console.error('Admin edit user error:', err);
      res.redirect('/admin/users?error=edit_failed');
    }
  },

  async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { new_password } = req.body;
      if (!new_password || new_password.length < 6) {
        return res.redirect('/admin/users?error=password_short');
      }
      const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
      await User.changePassword(id, hashed);
      if (parseInt(id) === parseInt(req.session.userId)) {
        req.session.destroy(() => {});
        return res.redirect('/login');
      }
      res.redirect('/admin/users?success=password_changed');
    } catch (err) {
      console.error('Admin change password error:', err);
      res.redirect('/admin/users?error=password_failed');
    }
  },

  async departments(req, res) {
    try {
      const depts = await Department.getAll();
      res.json(depts);
    } catch (err) {
      console.error('Department list error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async addDepartment(req, res) {
    try {
      const name = (req.body.name || '').trim();
      const costcenter = (req.body.costcenter || '').trim() || null;
      if (!name) {
        return res.redirect('/admin/users?error=dept_name_required');
      }
      const existing = await Department.getByName(name);
      if (existing) {
        return res.redirect('/admin/users?error=dept_exists');
      }
      if (costcenter) {
        const existingCode = await Department.getByCostcenter(costcenter);
        if (existingCode) {
          return res.redirect('/admin/users?error=dept_costcenter_exists');
        }
      }
      await Department.create(name, costcenter);
      res.redirect('/admin/users?success=dept_added');
    } catch (err) {
      console.error('Add department error:', err);
      res.redirect('/admin/users?error=dept_add_failed');
    }
  },

  async importDepartments(req, res) {
    if (!req.file) {
      return res.redirect('/admin/users?error=dept_file_required');
    }
    const filePath = req.file.path;
    try {
      const parsed = parseDepartmentExcel(filePath);
      if (parsed.rows.length === 0) {
        return res.redirect('/admin/users?error=dept_no_valid_rows');
      }

      let inserted = 0;
      let updated = 0;
      for (const row of parsed.rows) {
        const byCode = await Department.getByCostcenter(row.costcenter);
        if (byCode) {
          await Department.update(byCode.id, { name: row.name });
          updated++;
          continue;
        }
        const byName = await Department.getByName(row.name);
        if (byName) {
          await Department.update(byName.id, { costcenter: row.costcenter });
          updated++;
          continue;
        }
        await Department.create(row.name, row.costcenter);
        inserted++;
      }

      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'import',
        module: 'department',
        target: req.file.originalname,
        details: JSON.stringify({ inserted, updated, skippedRows: parsed.skippedRows, skippedSheets: parsed.skippedSheets.length })
      });

      const q = new URLSearchParams({
        success: 'dept_imported',
        inserted: String(inserted),
        updated: String(updated),
        skippedRows: String(parsed.skippedRows),
        skippedSheets: String(parsed.skippedSheets.length)
      });
      return res.redirect('/admin/users?' + q.toString());
    } catch (err) {
      console.error('Import departments error:', err);
      return res.redirect('/admin/users?error=dept_import_failed');
    } finally {
      fs.unlink(filePath, () => {});
    }
  },

  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      await Department.deleteById(id);
      res.redirect('/admin/users?success=dept_deleted');
    } catch (err) {
      console.error('Delete department error:', err);
      res.redirect('/admin/users?error=dept_delete_failed');
    }
  },

  async categories(req, res) {
    try {
      const cats = await Category.getAll();
      res.json(cats);
    } catch (err) {
      console.error('Category list error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async addCategory(req, res) {
    try {
      const code = (req.body.code || '').trim();
      const name = (req.body.name || '').trim();
      if (!code) {
        return res.redirect('/admin/users?error=cat_code_required');
      }
      if (!name) {
        return res.redirect('/admin/users?error=cat_name_required');
      }
      const existingCode = await Category.getByCode(code);
      if (existingCode) {
        return res.redirect('/admin/users?error=cat_code_exists');
      }
      const existingName = await Category.getByName(name);
      if (existingName) {
        return res.redirect('/admin/users?error=cat_exists');
      }
      await Category.create(code, name);
      res.redirect('/admin/users?success=cat_added');
    } catch (err) {
      console.error('Add category error:', err);
      res.redirect('/admin/users?error=cat_add_failed');
    }
  },

  async importCategories(req, res) {
    if (!req.file) {
      return res.redirect('/admin/users?error=cat_file_required');
    }
    const filePath = req.file.path;
    try {
      const parsed = parseCategoryExcel(filePath);
      if (parsed.rows.length === 0) {
        return res.redirect('/admin/users?error=cat_no_valid_rows');
      }

      let inserted = 0;
      let updated = 0;
      for (const row of parsed.rows) {
        const byCode = await Category.getByCode(row.code);
        if (byCode) {
          await Category.update(byCode.id, { name: row.name });
          updated++;
          continue;
        }
        const byName = await Category.getByName(row.name);
        if (byName) {
          await Category.update(byName.id, { code: row.code });
          updated++;
          continue;
        }
        await Category.create(row.code, row.name);
        inserted++;
      }

      await ActivityLog.create({
        userId: req.session.userId,
        username: req.session.username,
        action: 'import',
        module: 'category',
        target: req.file.originalname,
        details: JSON.stringify({ inserted, updated, skippedRows: parsed.skippedRows, skippedSheets: parsed.skippedSheets.length })
      });

      const q = new URLSearchParams({
        success: 'cat_imported',
        inserted: String(inserted),
        updated: String(updated),
        skippedRows: String(parsed.skippedRows),
        skippedSheets: String(parsed.skippedSheets.length)
      });
      return res.redirect('/admin/users?' + q.toString());
    } catch (err) {
      console.error('Import categories error:', err);
      return res.redirect('/admin/users?error=cat_import_failed');
    } finally {
      fs.unlink(filePath, () => {});
    }
  },

  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      await Category.deleteById(id);
      res.redirect('/admin/users?success=cat_deleted');
    } catch (err) {
      console.error('Delete category error:', err);
      res.redirect('/admin/users?error=cat_delete_failed');
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const { confirm_password } = req.body;
      const userId = req.session.userId;

      if (parseInt(id) === parseInt(userId)) {
        return res.redirect('/admin/users?error=cannot_delete_self');
      }

      const admin = await User.findByIdWithPassword(userId);
      if (!admin) {
        return res.redirect('/admin/users?error=admin_not_found');
      }

      const match = await bcrypt.compare(confirm_password, admin.password);
      if (!match) {
        return res.redirect('/admin/users?error=wrong_password');
      }

      await User.deleteById(id);
      res.redirect('/admin/users?success=user_deleted');
    } catch (err) {
      console.error('Delete user error:', err);
      res.redirect('/admin/users?error=delete_user_failed');
    }
  }
};

module.exports = adminController;
