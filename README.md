# Asset Management System

ระบบจัดการสินทรัพย์ (ครุภัณฑ์) — Express + EJS + MySQL. ประกอบด้วย การนำเข้าข้อมูลจาก Excel, ค้นหา/กรอง, โอนย้ายแผนก, ป้าย QR, เอกสาร PDF, บันทึกการใช้งาน (Log) และระบบสิทธิ์ผู้ใช้ (user / admin / super_admin).

## เริ่มต้นใช้งาน (สำหรับผู้พัฒนาที่รับช่วงต่อ)

```bash
# 1. คัดลอกไฟล์ .env แล้วใส่ค่า (สำคัญ: DB_* และ SESSION_SECRET)
cp .env.example .env

# 2. ติดตั้ง dependencies
npm install

# 3. สร้างบัญชี Super Admin ก่อนเริ่มใช้งาน (ทางเลือกที่ 1)
npm run create-admin

# 4. สตาร์ทระบบ
npm start
```

หรือ **ทางเลือกที่ 2** — สตาร์ทโดยยังไม่สร้าง admin: เปิดหน้า `/register` แล้ว **ผู้ใช้คนแรก** จะเห็นกล่องถามให้ตั้งบัญชีเป็น **Super Admin**:

- กล่องนี้จะแสดงไปเรื่อย ๆ **จนกว่าจะมี Super Admin เกิดขึ้นในระบบ**
- ถ้าผู้ใช้คนแรกไม่เลือก ระบบจะถามผู้สมัครคนถัดไปเรื่อย ๆ
- ไม่สามารถสร้าง Super Admin ซ้ำได้จากกล่องนี้ (มี admin แล้ว ระบบจะไม่ถามอีก)

หลังจากได้ Super Admin แล้ว ให้เข้าสู่ระบบและจัดการผู้ใช้/แผนก/หมวดได้ที่หน้า `/admin/users`

## เจ้าของไฟล์ .env

| ตัวแปร | ค่าแนะนำ | ความหมาย |
|---|---|---|
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | ตามเครื่อง | ตั้งค่าการเชื่อมต่อ MySQL (ตารางถูกสร้างอัตโนมัติตอน `npm start`) |
| `SESSION_SECRET` | สุ่มยาว ๆ | ใช้เซ็นต์ session cookie (generate: `openssl rand -hex 32`) |
| `ALLOW_REGISTRATION` | `true` (dev) / `false` (production) | เปิด/ปิดหน้า `/register` |
| `COOKIE_SECURE` | `true` เมื่ออยู่หลัง HTTPS | ใช้กับ nginx + certbot |

> **คำแนะนำด้านความปลอดภัย:** บนเว็บจริง (production) ควรปิดหน้าเปิดสมัคร (`ALLOW_REGISTRATION=false`) และสร้าง Super Admin ผ่าน `npm run create-admin` แทน เพราะหน้าสมัครแบบ "คนแรกเป็น admin" มีไว้เพื่อการติดตั้งครั้งแรกเท่านั้น — ถ้าเปิดทิ้งไว้ ใครก็ตามที่สมัครก่อนได้ก็จะเป็นผู้ดูแลระบบ

## คำสั่ง Gen รหัสผ่าน (ถ้าสร้าง admin ด้วยมือ)

สคริปต์ `npm run create-admin` จัดการ bcrypt hash ให้อัตโนมัติ ไม่จำเป็นต้องทำด้วยมือ

## เดploy (กรณีใช้บน VM/Server)

```bash
git pull
npm install        # ถ้ามี dependency ใหม่
npm run create-admin   # เฉพาะเครื่องที่ยังไม่มี Super Admin
pm2 restart app   # หรือตาม systemd/service ที่ใช้
```