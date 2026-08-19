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
  const subject = 'ยืนยันอีเมลของคุณ - Asset Management';
  const body = `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Tahoma,Geneva,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
    <div style="font-size:28px;margin-bottom:8px;">&#128274;</div>
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">Asset Management</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px;">ระบบจัดการทรัพย์สิน</p>
  </td></tr>
  <tr><td style="padding:36px 40px 16px;">
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 16px;font-weight:600;">ยืนยันอีเมลของคุณ</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
      ขอบคุณที่สมัครสมาชิกกับเรา กรุณายืนยันอีเมลของคุณโดยคลิกปุ่มด้านล่าง
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td style="background:#2563eb;border-radius:8px;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">ยืนยันอีเมล</a>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:8px 40px 32px;">
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
      หรือคัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>
      <a href="${verifyUrl}" style="color:#2563eb;word-break:break-all;font-size:12px;">${verifyUrl}</a>
    </p>
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">
      &#9200; ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง
    </p>
  </td></tr>
</table>
<table width="520" cellpadding="0" cellspacing="0">
  <tr><td style="padding:20px 40px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">อัตโนมัติจากระบบ Asset Management &middot; กรุณาอย่าตอบกลับอีเมลนี้</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

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
