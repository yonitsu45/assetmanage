const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  if (req.session && req.session.userId) {
    return res.redirect('/documents');
  }
  res.redirect('/login');
};

const requireSuperAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'super_admin') {
    return next();
  }
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.redirect('/login');
};

const redirectIfAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  next();
};

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, redirectIfAuth };
