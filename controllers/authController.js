const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user');

const SALT_ROUNDS = 10;

const isRegistrationOpen = () => process.env.ALLOW_REGISTRATION !== 'false';
const isRecaptchaEnabled = () => !!process.env.RECAPTCHA_SECRET_KEY;

function validatePassword(password) {
  if (password.length < 8) return 'error_password_length';
  if (!/[A-Z]/.test(password)) return 'error_password_complexity';
  if (!/[a-z]/.test(password)) return 'error_password_complexity';
  if (!/[0-9]/.test(password)) return 'error_password_complexity';
  if (!/[!@#$%^&*]/.test(password)) return 'error_password_complexity';
  return null;
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

async function verifyRecaptcha(token) {
  if (!isRecaptchaEnabled()) return true;
  if (!token) return false;
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token
      })
    });
    const data = await resp.json();
    return data.success === true;
  } catch (err) {
    console.error('reCAPTCHA verify error:', err);
    return false;
  }
}

function sendVerifyEmail(email, token, lang) {
  const nodemailer = require('nodemailer');
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'Asset Management <no-reply@localhost>';
  const baseUrl = process.env.BASE_URL || 'https://assetmanage.duckdns.org';

  if (!host || !user) {
    console.log(`[DEV MODE] Verify token for ${email}: ${baseUrl}/verify/${token}`);
    return Promise.resolve();
  }

  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const verifyUrl = `${baseUrl}/verify/${token}`;
  const subject = lang === 'th' ? 'ยืนยันอีเมลของคุณ - Asset Management' : 'Verify Your Email - Asset Management';
  const body = lang === 'th'
    ? `<h2>ยืนยันอีเมลของคุณ</h2><p>คลิกลิงก์ด้านล่างเพื่อยืนยันอีเมล:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>ลิงก์จะหมดอายุใน 24 ชั่วโมง</p>`
    : `<h2>Verify Your Email</h2><p>Click the link below to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`;

  return transporter.sendMail({ from, to: email, subject, html: body }).catch(err => {
    console.error('Send verify email error:', err);
  });
}

const authController = {
  showLogin(req, res) {
    res.render('login', { error: null });
  },

  async login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('login', { error: req.__('auth.error_required') });
    }

    const captchaToken = req.body['g-recaptcha-response'];
    const captchaOk = await verifyRecaptcha(captchaToken);
    if (!captchaOk) {
      return res.render('login', { error: req.__('auth.error_captcha') });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.render('login', { error: req.__('auth.error_invalid') });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: req.__('auth.error_invalid') });
    }

    if (user.email_verified === 0) {
      return res.render('login', { error: req.__('auth.error_email_unverified'), unverifiedEmail: user.email });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fullName = user.full_name || user.username;
    req.session.email = user.email;
    req.session.role = user.role || 'user';
    req.session.department = user.department || null;
    req.session.profilePicture = user.profile_picture || null;
    res.redirect('/');
  },

  showRegister(req, res) {
    if (!isRegistrationOpen()) return res.redirect('/login?register=disabled');
    const Department = require('../models/department');
    Department.getAll().then(departments => {
      res.render('register', { error: null, departments });
    }).catch(() => {
      res.render('register', { error: null, departments: [] });
    });
  },

  async register(req, res) {
    if (!isRegistrationOpen()) return res.redirect('/login?register=disabled');
    const { username, email, password, confirm_password, full_name, department } = req.body;

    const captchaToken = req.body['g-recaptcha-response'];
    const captchaOk = await verifyRecaptcha(captchaToken);
    if (!captchaOk) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.error_captcha'), departments });
    }

    if (!username || !email || !password || !full_name) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.error_required'), departments });
    }

    if (!validateUsername(username)) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.error_username_format'), departments });
    }

    if (password !== confirm_password) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.error_password_match'), departments });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.' + pwError), departments });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.error_username_taken'), departments });
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      const Department = require('../models/department');
      let departments = [];
      try { departments = await Department.getAll(); } catch (e) {}
      return res.render('register', { error: req.__('auth.error_email_taken'), departments });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const userId = await User.create({ username, email, password: hashedPassword, full_name, role: 'user', department, verifyToken });

    await sendVerifyEmail(email, verifyToken, req.session.lang);

    res.render('login', { error: null, success: req.__('auth.verify_email_sent') });
  },

  async verifyEmail(req, res) {
    const { token } = req.params;
    if (!token) return res.redirect('/login');

    const user = await User.findByVerifyToken(token);
    if (!user) return res.redirect('/login?verify=invalid');

    if (user.email_verified === 1) return res.redirect('/login?verify=already');

    await User.verifyEmail(user.id);
    res.redirect('/login?verify=success');
  },

  async resendVerify(req, res) {
    const { email } = req.body;
    if (!email) return res.redirect('/login');

    const user = await User.findByEmail(email);
    if (!user || user.email_verified === 1) return res.redirect('/login');

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await User.update(user.id, { verify_token: verifyToken });

    await sendVerifyEmail(email, verifyToken, req.session.lang);
    res.redirect('/login?verify=sent');
  },

  logout(req, res) {
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      res.clearCookie('connect.sid', { path: '/', httpOnly: true, secure: process.env.COOKIE_SECURE === 'true' });
      res.redirect('/login');
    });
  }
};

module.exports = authController;
