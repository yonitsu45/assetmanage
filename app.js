require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { pool, initDB } = require('./config/db');
const { requireAuth, requireSuperAdmin } = require('./middleware/auth');
const { generateCsrfToken } = require('./middleware/csrf');
const Department = require('./models/department');

const localeMiddleware = require('./middleware/locale');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const documentsRoutes = require('./routes/documents');
const profileRoutes = require('./routes/profile');
const updateRoutes = require('./routes/update');
const logsRoutes = require('./routes/logs');
const transferRoutes = require('./routes/transfer');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asset_management',
  charset: 'utf8mb4',
  createDatabaseTable: true
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: parseInt(process.env.SESSION_EXPIRY) || 86400000,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax'
  }
}));

app.use(generateCsrfToken);
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));
app.use(localeMiddleware);

app.get('/lang/:lang', (req, res) => {
  if (['en', 'th'].includes(req.params.lang)) {
    req.session.lang = req.params.lang;
  }
  res.redirect(req.get('Referer') || '/');
});

app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username,
    fullName: req.session.fullName,
    email: req.session.email,
    role: req.session.role,
    department: req.session.department,
    profilePicture: req.session.profilePicture
  } : null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  res.locals.ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION !== 'false';
  next();
});

app.use(async (req, res, next) => {
  try {
    const depts = await Department.getAll();
    res.locals.departments = depts;
    res.locals.deptList = depts;
  } catch (e) {
    res.locals.departments = [];
    res.locals.deptList = [];
  }
  next();
});

app.use('/', authRoutes);
app.use('/', requireAuth, dashboardRoutes);
app.use('/', requireAuth, profileRoutes);
app.use('/upload', requireAuth, uploadRoutes);
app.use('/documents', requireAuth, documentsRoutes);
app.use('/update', requireAuth, updateRoutes);
app.use('/transfer', requireAuth, transferRoutes);
app.use('/logs', requireAuth, logsRoutes);

const adminRoutes = require('./routes/admin');
app.use('/admin', requireAuth, requireSuperAdmin, adminRoutes);

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal server error');
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

initDB()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
