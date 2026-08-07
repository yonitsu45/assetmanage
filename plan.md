# Asset Management Web Application — Project Plan

## 1. Overview

เว็บแอปพลิเคชันสำหรับจัดการสินทรัพย์ (Asset Management) รองรับการนำเข้าไฟล์ Excel,
แสดง Dashboard พร้อมสรุปข้อมูล, ค้นหา, เรียงลำดับ, จัดการข้อมูลสินทรัพย์,
โอนย้ายระหว่างแผนก, จัดการเอกสาร, ระบบผู้ใช้/สิทธิ์, และ Activity Log

---

## 2. Tech Stack

| Component      | Technology                                      |
| -------------- | ----------------------------------------------- |
| **Backend**    | Node.js + Express.js 5                          |
| **Frontend**   | EJS Templates + Bootstrap 5.3.3 + Bootstrap Icons |
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
│   └── db.js                   # MySQL pool + auto-migration (initDB)
├── middleware/
│   ├── upload.js               # Multer config (.xlsx/.xls, max 10MB)
│   ├── auth.js                 # requireAuth / redirectIfAuth / requireRole
│   └── locale.js               # __() localization (EN/TH)
├── routes/
│   ├── auth.js                 # /login, /register, /logout
│   ├── dashboard.js            # GET /, export, edit, delete
│   ├── upload.js               # GET /upload, POST file/manual
│   ├── update.js               # Edit-by-Upload (/update)
│   ├── transfer.js             # Asset transfer (/transfer)
│   ├── documents.js            # Document management (/documents)
│   ├── logs.js                 # Activity log (/logs)
│   ├── profile.js              # User profile (/profile)
│   └── admin.js                # Admin panel (/admin/users)
├── controllers/
│   ├── authController.js
│   ├── dashboardController.js
│   ├── uploadController.js     # XLSX parse + mapping + required validation
│   ├── updateController.js     # Preview diff + apply
│   ├── transferController.js   # Transfer logic + log
│   ├── documentController.js
│   ├── logController.js
│   ├── profileController.js
│   └── adminController.js      # User management + category import
├── models/
│   ├── asset.js                # CRUD, search, sort, pagination, export
│   ├── user.js
│   ├── activityLog.js
│   ├── document.js
│   ├── transfer.js
│   ├── department.js
│   └── category.js
├── helpers/
│   └── excelParser.js          # Generic header-scan + column mapping
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   ├── navbar.ejs
│   │   ├── sidebar.ejs         # Collapsible + dept filter + transfer link
│   │   └── footer.ejs          # Bootstrap JS, sidebar.js, dept-combo.js
│   ├── dashboard.ejs           # 24-column raw table + summary + edit modal
│   ├── upload.ejs              # Drag&drop + manual entry form
│   ├── update.ejs              # Preview change/unchanged/new
│   ├── transfer.ejs            # Transfer form with dept combobox
│   ├── documents.ejs / document-view.ejs
│   ├── logs.ejs / log-detail.ejs
│   ├── admin-users.ejs         # Users + Categories (tab 3)
│   ├── asset-detail.ejs
│   ├── login.ejs / register.ejs
│   └── profile.ejs
├── locales/
│   ├── en.json                 # English strings (all views/controllers)
│   └── th.json                 # ไทย strings
├── public/
│   ├── css/
│   │   └── style.css           # ellipsis, dept dropdown scroll, etc.
│   └── js/
│       ├── sidebar.js
│       └── dept-combo.js       # Sidebar filter + transfer combobox
└── uploads/                    # Temp uploaded files (gitignored)
```

---

## 4. Database Schema

### Table: `users`

| Column           | Type             | Notes                     |
| ---------------- | ---------------- | ------------------------- |
| id               | INT AUTO_INCREMENT PK |                     |
| username         | VARCHAR(50)      | UNIQUE                    |
| email            | VARCHAR(100)     | UNIQUE                    |
| password         | VARCHAR(255)     | bcrypt hash               |
| full_name        | VARCHAR(100)     |                           |
| profile_picture  | VARCHAR(255)     |                           |
| role             | VARCHAR(20)      | `user` / `admin` / `super_admin` |
| department       | VARCHAR(100)     |                           |
| created_at       | DATETIME         | DEFAULT CURRENT_TIMESTAMP |

### Table: `assets`

| Column             | Type             | Notes                        |
| ------------------ | ---------------- | ---------------------------- |
| asset_id           | VARCHAR(100)     | **PRIMARY KEY**              |
| business_unit      | VARCHAR(100)     |                              |
| tag_number         | VARCHAR(100)     | INDEX                        |
| tag_number_extend  | VARCHAR(100)     |                              |
| serial_number_asset| VARCHAR(100)     | INDEX                        |
| descr              | VARCHAR(255)     |                              |
| descr_long         | TEXT             |                              |
| model              | VARCHAR(100)     |                              |
| plant              | VARCHAR(100)     |                              |
| serial_id          | VARCHAR(100)     | INDEX                        |
| vendor_id          | VARCHAR(100)     |                              |
| vendor_name        | VARCHAR(255)     |                              |
| deptid             | VARCHAR(100)     |                              |
| dept_name          | VARCHAR(255)     |                              |
| category           | VARCHAR(100)     | INDEX                        |
| category_name      | VARCHAR(100)     | INDEX                        |
| x_asset_status     | VARCHAR(100)     |                              |
| asset_status       | VARCHAR(100)     | INDEX                        |
| x_asset_reason     | VARCHAR(255)     |                              |
| x_agreement_id     | VARCHAR(100)     |                              |
| uploaded_by        | INT              | FK → users(id) ON DELETE SET NULL |
| updated_at         | DATETIME         |                              |
| updated_by         | INT              | FK → users(id) ON DELETE SET NULL |
| created_at         | DATETIME         | DEFAULT CURRENT_TIMESTAMP    |

Charset: `utf8mb4` (รองรับภาษาไทย)

### Table: `activity_logs`

| Column | Type      | Notes                        |
| ------ | --------- | ---------------------------- |
| id     | INT AUTO_INCREMENT PK |                  |
| user_id| INT       | FK → users(id)               |
| username| VARCHAR  | snapshot (กัน user ถูกลบ)    |
| action | VARCHAR   | create/update/delete/upload/transfer/... |
| module | VARCHAR   | asset/category/document/user |
| target | VARCHAR   |                             |
| details| TEXT      | JSON                        |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### Table: `departments`

| Column    | Type         | Notes                    |
| --------- | ------------ | ------------------------ |
| id        | INT AUTO_INCREMENT PK |              |
| code      | VARCHAR(50)  | UNIQUE                   |
| name      | VARCHAR(255) | UNIQUE                   |
| costcenter| VARCHAR(50)  | NULL (UNIQUE)            |
| created_at| DATETIME     |                          |

### Table: `categories`

| Column    | Type         | Notes                    |
| --------- | ------------ | ------------------------ |
| id        | INT AUTO_INCREMENT PK |              |
| code      | VARCHAR(100) | UNIQUE                   |
| name      | VARCHAR(255) | UNIQUE                   |
| created_at| DATETIME     | DEFAULT CURRENT_TIMESTAMP |

### Table: `asset_transfers`

| Column   | Type         | Notes                    |
| -------- | ------------ | ------------------------ |
| id       | INT AUTO_INCREMENT PK |              |
| asset_id | VARCHAR      |                          |
| from_dept| VARCHAR      |                          |
| to_dept  | VARCHAR      |                          |
| transferred_by | INT |                          |
| created_at | DATETIME   |                          |

### Table: `documents`

| Column   | Type         | Notes                    |
| -------- | ------------ | ------------------------ |
| id       | INT AUTO_INCREMENT PK |              |
| filename | VARCHAR      |                          |
| filepath | VARCHAR      |                          |
| department | VARCHAR    |                          |
| uploaded_by | INT       |                          |
| created_at | DATETIME   |                          |

---

## 5. Routes & Authentication

| Method | Path                | Auth  | Role             | Description                    |
| ------ | ------------------- | ----- | ---------------- | ------------------------------ |
| GET    | /                   | ✅    | ใดก็ได้ (log-in) | Dashboard — summary + table    |
| GET    | /dashboard/export   | ✅    |                  | Export assets → Excel          |
| POST   | /dashboard/edit     | ✅    | super_admin      | Edit asset (modal)             |
| POST   | /dashboard/delete   | ✅    | super_admin      | Delete asset                   |
| GET    | /asset/:id          | ✅    |                  | Asset detail                   |
| GET    | /upload             | ✅    | admin, super_admin | Upload page                 |
| POST   | /upload/file        | ✅    | admin, super_admin | Excel import                |
| POST   | /upload/manual      | ✅    | admin, super_admin | Manual entry                |
| GET    | /update             | ✅    | admin, super_admin | Edit-by-upload form         |
| POST   | /update/preview     | ✅    | admin, super_admin | Preview diff                |
| POST   | /update/apply       | ✅    | admin, super_admin | Apply updates               |
| GET    | /transfer           | ✅    |                  | Transfer form                 |
| POST   | /transfer/create    | ✅    |                  | Submit transfer               |
| GET    | /documents ...      | ✅    |                  | Document CRUD + view          |
| GET    | /logs               | ✅    | admin, super_admin | Activity log               |
| GET    | /admin/users        | ✅    | super_admin      | User + category admin          |
| POST   | /admin/users/category | ✅  | super_admin      | Add category                   |
| POST   | /admin/users/category/import | ✅ | super_admin | Category Excel import  |
| POST   | /admin/users/category/delete/:id | ✅ | super_admin | Delete category      |
| GET    | /profile            | ✅    |                  | Profile page                   |
| GET    | /lang/:lang         | ✅    |                  | Switch EN/TH                   |
| GET    | /login /register    | ❌    |                  | Auth forms                     |
| POST   | /login /register /logout |  |                  | Auth actions                   |

---

## 6. Features

### 6.1 Authentication & Roles
- Register / Login / Logout, session เก็บใน MySQL
- Password hashed with bcrypt (salt rounds: 10)
- Middleware `requireAuth`, `redirectIfAuth`, `requireRole`
- Roles: `user` (ดูอย่างเดียว), `admin` (upload/update), `super_admin` (ทั้งหมด + admin panel)
- Localization EN/TH — ตัวสลับภาษาบน navbar, เก็บใน session

### 6.2 Sidebar Navigation
- Desktop: collapsible sidebar (250px ↔ 60px), state เก็บใน localStorage
- Mobile: overlay slide-in + backdrop
- Dropdown แผนก (super_admin) — พิมพ์ค้นหาได้ + scroll ได้ + ชื่อยาวถูกตัด (ellipsis)
- Active page highlighted

### 6.3 Dashboard
- **Summary cards**: Total assets, top statuses/categories/departments, last upload/modify
- **Search**: ค้นหาข้ามคอลัมน์
- **Sort**: click column header ASC/DESC
- **Pagination**: 25/50/100 ต่อหน้า
- **Table 24 คอลัมน์**: 22 ฟิลด์ raw (ตัวพิมพ์ใหญ่ ไม่แปล locale) + Checkbox + Action; scroll แนวนอน
- **Edit modal**: แก้ไขได้เฉพาะ super_admin
- **Export**: ส่งออกข้อมูลทั้งชุดเป็น Excel รวมคอลัมน์ใหม่

### 6.4 Excel Upload (Add Asset)
- **File**: `.xlsx`, `.xls` (max 10MB), drag & drop
- **Header scan**: `findHeaderRow()` สแกน 10 แถวแรกหาแถวที่เป็น header ผ่าน resolver
- **Column matching**: normalize + alias system (ดู §9)
- **Required validation (15 fields)**: แถวขาด required → **ข้ามแถวนั้น** แล้วแจ้ง summary ตอนแสดงผล (ไม่ abort ทั้งไฟล์)
- Manual form: ขาด required → error `upload.error_missing_required`
- **Append mode**: เพิ่มต่อ ไม่ลบของเก่า
- ค่าว่าง → NULL
- **หลังอัปโหลด** แสดงเฉพาะ alert สรุป (imported / skipped) — ข้อมูลวินิจฉัย raw ถูกนำออกแล้ว

### 6.5 Required Fields

**Required (15)**: `BUSINESS_UNIT, ASSET_ID, TAG_NUMBER, SERIAL_NUMBER_ASSET, TAG_NUMBER_EXTEND, DESCR, VENDOR_ID, VENDOR_NAME, DEPTID, DEPT_NAME, CATEGORY, CATEGORY_NAME, X_ASSET_STATUS, ASSET_STATUS, X_AGREEMENT_ID`

**Optional (5)**: `DESCR_LONG, MODEL, PLANT, SERIAL_ID, X_ASSET_REASON`

### 6.6 Supported Columns (22 — Fixed)

| # | Column Name        | Req | Description                |
|---|--------------------|-----|----------------------------|
| 1 | BUSINESS_UNIT      | ✅  | หน่วยธุรกิจ                 |
| 2 | ASSET_ID           | ✅  | รหัสสินทรัพย์ (PK)          |
| 3 | TAG_NUMBER         | ✅  | หมายเลข Tag                |
| 4 | TAG_NUMBER_EXTEND  | ✅  | Tag ต่อท้าย                |
| 5 | SERIAL_NUMBER_ASSET| ✅  | Serial ของตัวสินทรัพย์      |
| 6 | DESCR              | ✅  | คำอธิบายสั้น                |
| 7 | DESCR_LONG         |     | คำอธิบายยาว                 |
| 8 | MODEL              |     | รุ่น                        |
| 9 | PLANT              |     | โรงงาน                      |
|10 | SERIAL_ID          |     | หมายเลข Serial (DB)        |
|11 | VENDOR_ID          | ✅  | รหัสผู้ขาย                 |
|12 | VENDOR_NAME        | ✅  | ชื่อผู้ขาย                 |
|13 | DEPTID             | ✅  | รหัสแผนก                  |
|14 | DEPT_NAME          | ✅  | ชื่อแผนก                  |
|15 | CATEGORY           | ✅  | รหัสหมวดหมู่               |
|16 | CATEGORY_NAME      | ✅  | ชื่อหมวดหมู่               |
|17 | X_ASSET_STATUS     | ✅  | สถานะสินทรัพย์ (สำรอง)      |
|18 | ASSET_STATUS       | ✅  | สถานะสินทรัพย์             |
|19 | X_ASSET_REASON     |     | เหตุผล                     |
|20 | X_AGREEMENT_ID     | ✅  | เลขที่สัญญา                |
|21 | CREATED_AT         |     | (อ่านได้, ไม่บังคับ)        |
|22 | UPDATED_AT         |     | (อ่านได้, ไม่บังคับ)        |

---

## 7. UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR:  🏢 AssetManage   [🌐 EN/ไทย]   [User menu]      │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │                                               │
│ 📊       │            CONTENT AREA                       │
│ Dashboard│  (Dashboard / Upload / Update / Transfer /    │
│ 📁       │   Documents / Logs / Admin / Profile)          │
│ Upload   │                                               │
│ ...      │                                               │
├──────────┴───────────────────────────────────────────────┤
│  FOOTER  (Bootstrap JS + sidebar.js + dept-combo.js)      │
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
findHeaderRow(rawRows, resolver)  → สแกน 10 แถวแรก (generic)
    ↓
Map header → column ผ่าน ALL_COLUMNS + ALIASES
    ↓
ต่อแถว: getMissingRequired(row) → ถ้า missing > 0 → เก็บเป็น invalidRow (ข้าม)
    ↓
Asset.bulkInsert → INSERT INTO assets VALUES (...)
    ↓
Alert สรุปผล: imported + skipped (required) → แสดง warning รายคอลัมน์
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
| Excel Header       | Normalized        | Resolved To        |
|--------------------|-------------------|--------------------|
| TAG_NUMBER         | TAG_NUMBER        | TAG_NUMBER         |
| TAG_NUMBE (legacy) | TAG_NUMBE         | TAG_NUMBER         |
| DESCRIPTION        | DESCRIPTION       | DESCR              |
| SERIAL NUMBER      | SERIAL_NUMBER     | SERIAL_ID          |
| DEPT_ID            | DEPT_ID           | DEPTID             |
| Business Unit      | BUSINESS_UNIT     | BUSINESS_UNIT      |

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

# 3. Start server (auto-creates database & tables + migrations)
npm start        # หรือ node app.js

# 4. Open browser → http://localhost:3000

# หมายเหตุ: node ไม่ auto-reload — ต้อง restart เองหลังแก้ server code
```

---

## 12. Completed Work (Implemented)

### 12.1 Localization (EN/TH)
- `locales/en.json` + `locales/th.json` + `middleware/locale.js` (`req.__` / `res.locals.__`)
- `GET /lang/:lang` — ตัวสลับภาษา, navbar dropdown (EN / ไทย)

### 12.2 Role System & Permissions
- Roles: `user`, `admin`, `super_admin`
- Admin panel `/admin` → super_admin เท่านั้น
- Dashboard edit/delete → super_admin เท่านั้น
- Upload/update → admin + super_admin

### 12.3 Documents
- PDF upload/download/view/delete + department tagging + grid/list view

### 12.4 Edit-by-Upload (`/update`)
- Preview: matched+identical → `unchanged`, matched+diff → `changed` (table old vs new + radio), unmatched → `new` (checkbox insert)
- Apply → update/insert + log

### 12.5 Activity Log (`/logs`)
- บันทึกการกระทำ upload/update/create/delete/clear/transfer/category
- ตาราง + filter module/action/search + pagination + detail page

### 12.6 Dashboard Enhancements (22 Columns — งานที่ 1)
- DB: `tag_numbe` → `tag_number`; เพิ่ม `tag_number_extend`, `serial_number_asset`, `category_name`
- Dashboard เป็นตาราง 22 คอลัมน์ raw (24 `<th>` รวม checkbox/action), หัวตารางตัวพิมพ์ใหญ่ ไม่แปล locale
- Required validation 15 ฟิลด์ — Excel: ข้ามแถวที่ขาด + สรุป warning; manual: error `upload.error_missing_required`
- Export รวมคอลัมน์ใหม่
- หลัง upload แสดงเฉพาะสรุปผล (ลบการ์ดวินิจฉัย info ออกจาก view/controller/locales)

### 12.7 Category Management (งานที่ 1)
- ตาราง `categories (id, code UNIQUE, name UNIQUE, created_at)`
- หน้าจัดการอยู่ tab 3 ของ `/admin/users`: เพิ่ม/ลบ/import Excel
- Import: ไล่ทุกชีท, header `CATEGORY`→code, `CATEGORY_NAME`→name, dedupe last-wins ด้วย code, upsert, ข้ามชีท/แถวเสีย
- ActivityLog module = `category`

### 12.8 Department Dropdown (งานที่ 2)
- **Sidebar dropdown (super_admin)**: เปลี่ยนเป็นลิสต์แผนก (214 แผนก) — พิมพ์ค้นหาได้ + scroll ได้ + ชื่อยาวตัด ellipsis
  - `#deptFilterInput` ค้นหา, แถว "ไม่พบแผนก" (no-match), Enter → ไปแผนกแรกที่ตรง, โฟกัสช่องเมื่อเปิด dropdown
- **Transfer combobox (`/transfer`)**: ซ่อน `<select name="to_dept">` เดิม (ยังเป็น source of truth — POST เดิมไม่ต้องแตะ)
  + input พิมพ์ + ลิสต์เลื่อน (max-height:220px) + คลิก/↑↓+Enter เลือก + Escape/blur ปิด + เคลียร์ช่อง → select='' (form validate เดิมยังทำงาน)
  - ข้อมูลแผนกส่งผ่าน `<script type="application/json" id="toDeptOptions">` (เลี่ยง double-escape ของ attribute)
- ไฟล์ใหม่ `public/js/dept-combo.js` (initSidebarDeptFilter + initDeptCombo), `views/partials/footer.ejs` โหลด script

### 12.9 Bug Fixes
- Dark mode login/register footer text invisible → CSS `!important`
- Super admin role หายเมื่อ restart → ลบ migration ที่ force role ออกจาก `initDB()`
- `req.__ is not a function` → locale middleware ตั้งทั้ง `req.__` และ `res.locals.__`
- Clear All Data button silent-fail → `__()` ใน `<script>` ต้องครอบ `<%= %>`
- Double-escape JSON ใน attribute (ชื่อแผนกมี `&`/`(`) → เปลี่ยนเป็น `<script type="application/json">`

---

## 13. Test Scripts (ใน `C:\Users\tustz\AppData\Local\Temp\opencode\`)

| Script                | ครอบคลุม                                  | ผลล่าสุด      |
| --------------------- | ----------------------------------------- | ------------- |
| `test-cat-dash.js`    | Parser unit, category CRUD/import, manual, upload validation, dashboard 24-col, edit, detail, export, transfer search, delete — + cleanup | ALL PASSED (63) |
| `test-dept-combo-dom.js` | DOM shim: sidebar filter + combobox logic (filter, no-match, click, keyboard, escape) | ALL PASSED (19) |
| `verify-dept-combo.js`| HTTP render: sidebar + transfer markup, toDeptOptions JSON 214, special chars, locale | ALL PASSED (16) |
| `verify-cleanup.js`    | ตรวจ/ล้างข้อมูลทดสอบค้าง                    | —            |
| `final-clean-check.js` | ตรวจความสะอาด DB หลังเทสต์                 | 0 leftovers  |

---

## 14. Future Enhancements (Ideas)
- Advanced filtering (multi-select, date range)
- API endpoints for external integration
- Dashboard charts (graph-based summary)
