const fs = require('fs');
const path = require('path');

const locales = {};
const localesDir = path.join(__dirname, '..', 'locales');

fs.readdirSync(localesDir).forEach(file => {
  if (file.endsWith('.json')) {
    const lang = path.basename(file, '.json');
    locales[lang] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  }
});

function t(lang, key, ...args) {
  const keys = key.split('.');
  let val = locales[lang];
  for (const k of keys) {
    if (val && typeof val === 'object' && k in val) {
      val = val[k];
    } else {
      val = locales['en'];
      for (const kk of keys) {
        if (val && typeof val === 'object' && kk in val) {
          val = val[kk];
        } else {
          return key;
        }
      }
      break;
    }
  }
  if (typeof val === 'string') {
    let i = 0;
    return val.replace(/%s|%d/g, (m) => args[i] !== undefined ? args[i++] : m);
  }
  return key;
}

module.exports = function (req, res, next) {
  const supported = Object.keys(locales);
  let lang = req.session ? req.session.lang : null;
  if (!lang || !supported.includes(lang)) {
    const accept = req.headers['accept-language'] || '';
    if (accept.startsWith('th')) {
      lang = 'th';
    } else {
      lang = 'en';
    }
    if (req.session) req.session.lang = lang;
  }
  req.lang = lang;
  req.__ = function (key, ...args) {
    return t(req.lang || 'en', key, ...args);
  };
  res.locals.lang = lang;
  res.locals.__ = req.__;
  next();
};
