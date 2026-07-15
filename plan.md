# Asset Management Web Application — Project Plan

## 1. Overview

เว็บแอปพลิเคชันสำหรับจัดการสินทรัพย์ (Asset Management) รองรับการนำเข้าไฟล์ Excel,
แสดง Dashboard พร้อมสรุปข้อมูล, ค้นหา, เรียงลำดับ, และจัดการข้อมูลสินทรัพย์

---

## 2. Tech Stack

| Component      | Technology                                      |
| -------------- | ----------------------------------------------- |
| **Backend**    | Node.js + Express.js 5                          |
| **Frontend**   | EJS Templates + Bootstrap 5 + Bootstrap Icons   |
| **Database**   | MySQL (via `mysql2` driver)                     |
| **Session**    | `express-session` + `express-mysql-session`     |
| **Password**   | `bcrypt`                                        |
| **File Upload**| `multer`                                        |
| **Excel Parse**| `xlsx` (SheetJS)                                |
| **Config**     | `dotenv`                                        |

---

## 3. Project Structure

```
assetmanage/
├── app.js                      # Entry point — Express server
├── package.json
├── .env                        # DB credentials, session secret
├── .gitignore
├── config/
│   └── db.js                   # MySQL connection pool + table initialization
├── middleware/
│   ├── upload.js               # Multer config (.xlsx/.xls, max 10MB)
│   └── auth.js                 # requireAuth / redirectIfAuth
├── routes/
│   ├── auth.js                 # /login, /register, /logout
│   ├── dashboard.js            # GET /, POST /clear
│   └── upload.js               # GET /upload, POST /upload
├── controllers/
│   ├── authController.js       # bcrypt login/register/logout
│   ├── dashboardController.js  # Summary queries + pagination
│   └── uploadController.js     # XLSX parse + column mapping + insert
├── models/
│   ├── asset.js                # Asset CRUD, search, sort, pagination
│   └── user.js                 # User find/create
├── views/
│   ├── partials/
│   │   ├── header.ejs          # HTML head, Bootstrap CSS
│   │   ├── navbar.ejs          # Top navbar (Login/Register or user menu)
│   │   ├── sidebar.ejs         # Collapsible sidebar (Dashboard, Upload)
│   │   └── footer.ejs          # Bootstrap JS, sidebar.js
│   ├── dashboard.ejs           # Summary cards + searchable/sortable table
│   ├── upload.ejs              # Drag & drop upload form + diagnostics
│   ├── login.ejs               # Login form
│   └── register.ejs            # Register form
├── public/
│   ├── css/
│   │   └── style.css           # Custom styles (sidebar, table scroll, etc.)
│   └── js/
│       └── sidebar.js          # Collapsible sidebar + mobile overlay
└── uploads/                    # Temp uploaded files (gitignored)
```

---

## 4. Database Schema

### Table: `users`

| Column     | Type             | Notes                     |
| ---------- | ---------------- | ------------------------- |
| id         | INT AUTO_INCREMENT PK |                     |
| username   | VARCHAR(50)      | UNIQUE                    |
| email      | VARCHAR(100)     | UNIQUE                    |
| password   | VARCHAR(255)     | bcrypt hash               |
| full_name  | VARCHAR(100)     |                           |
| created_at | DATETIME         | DEFAULT CURRENT_TIMESTAMP |

### Table: `assets`

| Column           | Type             | Notes                        |
| ---------------- | ---------------- | ---------------------------- |
| id               | INT AUTO_INCREMENT PK |                        |
| business_unit    | VARCHAR(100)     |                              |
| asset_id         | VARCHAR(100)     | INDEX                        |
| tag_numbe        | VARCHAR(100)     | INDEX                        |
| descr            | VARCHAR(255)     |                              |
| descr_long       | TEXT             |                              |
| model            | VARCHAR(100)     |                              |
| plant            | VARCHAR(100)     |                              |
| serial_id        | VARCHAR(100)     | INDEX                        |
| vendor_id        | VARCHAR(100)     |                              |
| vendor_name      | VARCHAR(255)     |                              |
| deptid           | VARCHAR(100)     |                              |
| dept_name        | VARCHAR(255)     |                              |
| category         | VARCHAR(100)     | INDEX                        |
| x_asset_status   | VARCHAR(100)     |                              |
| asset_status     | VARCHAR(100)     | INDEX                        |
| x_asset_reason   | VARCHAR(255)     |                              |
| x_agreement_id   | VARCHAR(100)     |                              |
| created_at       | DATETIME         | DEFAULT CURRENT_TIMESTAMP    |

Charset: `utf8mb4` (รองรับภาษาไทย)

---

## 5. Routes & Authentication

| Method | Path         | Auth Required | Description                    |
| ------ | ------------ | ------------- | ------------------------------ |
| GET    | /            | ✅ Yes        | Dashboard — summary + table    |
| POST   | /clear       | ✅ Yes        | Clear all asset data           |
| GET    | /upload      | ✅ Yes        | Upload page                    |
| POST   | /upload      | ✅ Yes        | Handle Excel file upload       |
| GET    | /login       | ❌ No         | Login form                     |
| POST   | /login       | ❌ No         | Authenticate + create session  |
| GET    | /register    | ❌ No         | Register form                  |
| POST   | /register    | ❌ No         | Create user account            |
| POST   | /logout      | ✅ Yes        | Destroy session                |

---

## 6. Features

### 6.1 Authentication
- Register (username, email, password, full name)
- Login with session stored in MySQL
- Password hashed with bcrypt (salt rounds: 10)
- Middleware `requireAuth` protects all routes except login/register
- `redirectIfAuth` middleware prevents logged-in users from seeing login/register pages

### 6.2 Sidebar Navigation
- Desktop: collapsible sidebar (250px ↔ 60px)
- Mobile: overlay slide-in with backdrop
- State saved in `localStorage`
- Active page highlighted

### 6.3 Dashboard
- **Summary cards**: Total assets, top 5 statuses, top 5 categories, top 5 departments
- **Search**: ค้นหาข้ามคอลัมน์ (asset_id, tag_numbe, descr, descr_long, serial_id, vendor_name, dept_name, model)
- **Sort**: Click column headers to sort ASC/DESC
- **Pagination**: 25/50/100 rows per page
- **Table**: 17 fixed columns with horizontal scroll
- **Clear All Data**: Delete all asset records

### 6.4 Excel Upload
- **File format**: `.xlsx`, `.xls` (max 10MB)
- **Drag & drop** or click to browse
- **Column matching**: อ่าน header จากแถวแรกของ Excel แล้ว map ด้วย normalize + alias system
- **Alias system**: รองรับชื่อ column หลากหลาย เช่น TAG_NUMBER → TAG_NUMBE, DESCRIPTION → DESCR ฯลฯ
- **Fallback parsing**: ถ้าไฟล์ไม่ใช่ .xlsx จริงๆ (เช่น CSV/TSV) จะพยายามอ่านเป็น plain text
- **Append mode**: เพิ่มข้อมูลต่อจากที่มีอยู่ ไม่ลบของเก่า
- **Diagnostics**: แสดง column ที่ detect ได้ + column ที่ match + ตัวอย่างข้อมูล
- **การจัดการค่าว่าง**: ช่องว่างหรือ column ที่ไม่มี → เก็บเป็น NULL ใน database

### 6.5 Supported Columns (Fixed)

| # | Column Name      | Description                  |
|---|------------------|------------------------------|
| 1 | BUSINESS_UNIT    | หน่วยธุรกิจ                   |
| 2 | ASSET_ID         | รหัสสินทรัพย์                 |
| 3 | TAG_NUMBE        | หมายเลข Tag                  |
| 4 | DESCR            | คำอธิบายสั้น                  |
| 5 | DESCR_LONG       | คำอธิบายยาว                   |
| 6 | MODEL            | รุ่น                         |
| 7 | PLANT            | โรงงาน                       |
| 8 | SERIAL_ID        | หมายเลข Serial               |
| 9 | VENDOR_ID        | รหัสผู้ขาย                   |
| 10| VENDOR_NAME      | ชื่อผู้ขาย                   |
| 11| DEPTID           | รหัสแผนก                    |
| 12| DEPT_NAME        | ชื่อแผนก                    |
| 13| CATEGORY         | หมวดหมู่                     |
| 14| X_ASSET_STATUS   | สถานะสินทรัพย์ (สำรอง)        |
| 15| ASSET_STATUS     | สถานะสินทรัพย์               |
| 16| X_ASSET_REASON   | เหตุผล                       |
| 17| X_AGREEMENT_ID   | เลขที่สัญญา                  |

---

## 7. UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR:  🏢 AssetManage          [Login] [Register]      │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │                                               │
│ 📊       │            CONTENT AREA                       │
│ Dashboard│  (Dashboard table / Upload form / Auth forms)  │
│ 📁       │                                               │
│ Upload   │                                               │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│  FOOTER                                                   │
└──────────────────────────────────────────────────────────┘
```

### Sidebar States

| State     | Width  | Description                        |
|-----------|--------|------------------------------------|
| Expanded  | 250px  | Full text + icons                  |
| Collapsed | 60px   | Icons only (desktop)               |
| Mobile    | overlay| Slide-in from left with backdrop    |

---

## 8. Data Flow — Upload

```
User selects file → Multer saves to /uploads
    ↓
XLSX.readFile(filePath)
    ↓
Check file magic bytes (ZIP header for .xlsx)
  ├─ ZIP (.xlsx real) → XLSX.readFile
  └─ Not ZIP → read as plain text CSV/TSV
    ↓
sheet_to_json({ header: 1 }) → array of arrays
    ↓
Row 0 = headers → normalize → resolve column via ALL_COLUMNS + ALIASES
    ↓
Rows 1..N = data → map to { business_unit, asset_id, ... }
    ↓
Asset.bulkInsert → INSERT INTO assets VALUES (...)
    ↓
Show result + diagnostics to user
```

---

## 9. Column Matching Algorithm

```
Excel Header → normalizeHeader()
  ├─ .toString().trim().toUpperCase()
  ├─ Replace spaces/hyphens with underscore
  └─ Remove non-alphanumeric characters (except underscore)
    ↓
resolveColumn(normalized)
  ├─ if in ALL_COLUMNS → return as-is
  └─ if in ALIASES → return alias target
    ↓
If resolved → map Excel column to DB column
If not resolved → column ignored (data = NULL)
```

### Alias Examples
| Excel Header       | Normalized        | Resolved To       |
|--------------------|-------------------|-------------------|
| TAG_NUMBER         | TAG_NUMBER        | TAG_NUMBE         |
| DESCRIPTION        | DESCRIPTION       | DESCR             |
| SERIAL NUMBER      | SERIAL_NUMBER     | SERIAL_ID         |
| DEPT_ID            | DEPT_ID           | DEPTID            |
| Business Unit      | BUSINESS_UNIT     | BUSINESS_UNIT     |

---

## 10. Dependencies (npm)

```json
{
  "express": "^5.2",
  "ejs": "^6.0",
  "mysql2": "^3.22",
  "multer": "^2.2",
  "xlsx": "^0.18",
  "dotenv": "^17.4",
  "bcrypt": "^6.0",
  "express-session": "^1.19",
  "express-mysql-session": "^3.0"
}
```

---

## 11. Running the App

```bash
# 1. Install dependencies
npm install

# 2. Configure .env (DB connection, session secret)
#    DB_NAME=asset_management will be created automatically

# 3. Start server (auto-creates database & tables)
npm start

# 4. Open browser → http://localhost:3000
```

---

## 12. Future Enhancements (Ideas)
- User roles (admin, viewer)
- Edit asset records inline
- Export data to Excel
- File history / audit log
- Advanced filtering (multi-select, date range)
- API endpoints for external integration
