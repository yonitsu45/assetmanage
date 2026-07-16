const bcrypt = require('bcrypt');
const User = require('../models/user');

const SALT_ROUNDS = 10;

const authController = {
  showLogin(req, res) {
    res.render('login', { error: null });
  },

  async login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('login', { error: 'Username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    req.session.fullName = user.full_name || user.username;
    req.session.email = user.email;
    req.session.role = user.role || 'user';
    req.session.department = user.department || null;
    res.redirect('/');
  },

  showRegister(req, res) {
    res.render('register', { error: null });
  },

  async register(req, res) {
    const { username, email, password, confirm_password, full_name, role, department } = req.body;

    if (!username || !email || !password) {
      return res.render('register', { error: 'Please fill in all required fields' });
    }
    if (password !== confirm_password) {
      return res.render('register', { error: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.render('register', { error: 'Username already taken' });
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      return res.render('register', { error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({ username, email, password: hashedPassword, full_name, role: role || 'user', department });

    res.redirect('/login');
  },

  logout(req, res) {
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      res.redirect('/login');
    });
  }
};

module.exports = authController;
