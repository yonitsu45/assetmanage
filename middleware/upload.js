const multer = require('multer');
const path = require('path');
const fs = require('fs');

function decodeOriginalName(name) {
  if (!name || !/[\u00C0-\u00FF]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const pdfDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  file.originalname = decodeOriginalName(file.originalname);
  const allowed = ['.xlsx', '.xls', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .xlsx and .xls files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10485760 }
});

const pdfFilter = (req, file, cb) => {
  file.originalname = decodeOriginalName(file.originalname);
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const uploadPdf = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, pdfDir),
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.pdf';
      cb(null, uniqueName);
    }
  }),
  fileFilter: pdfFilter,
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10485760 },
  defParamCharset: 'utf8'
});

module.exports = upload;
module.exports.decodeOriginalName = decodeOriginalName;
module.exports.uploadPdf = uploadPdf;

const profileDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

const profileFilter = (req, file, cb) => {
  file.originalname = decodeOriginalName(file.originalname);
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed'), false);
  }
};

const uploadProfile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileDir),
    filename: (req, file, cb) => {
      const uniqueName = 'profile_' + Date.now() + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  }),
  fileFilter: profileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports.uploadProfile = uploadProfile;
