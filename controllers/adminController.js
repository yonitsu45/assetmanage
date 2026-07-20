const bcrypt = require('bcrypt');
const User = require('../models/user');
const Department = require('../models/department');
const SALT_ROUNDS = 10;

const adminController = {
  async index(req, res) {
    try {
      const sortBy = req.query.sort_by || 'created_at';
      const order = req.query.order || 'DESC';
      const users = await User.getAll({ sortBy, order });
      const departments = await Department.getAll();
      res.render('admin-users', { users, departments, error: null, success: null, reqQuery: req.query, sortBy, order });
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
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.redirect('/admin/users?error=dept_name_required');
      }
      const existing = await Department.getByName(name.trim());
      if (existing) {
        return res.redirect('/admin/users?error=dept_exists');
      }
      await Department.create(name.trim());
      res.redirect('/admin/users?success=dept_added');
    } catch (err) {
      console.error('Add department error:', err);
      res.redirect('/admin/users?error=dept_add_failed');
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
