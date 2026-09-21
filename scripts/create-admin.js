require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const { initDB, pool } = require('../config/db');

const SALT_ROUNDS = 10;
const isPiped = !process.stdin.isTTY;

let pipedLines = [];
let pipedReady = Promise.resolve();
if (isPiped) {
  pipedReady = new Promise((resolve) => {
    const ri = readline.createInterface({ input: process.stdin });
    ri.on('line', (l) => pipedLines.push(l.trim()));
    ri.on('close', () => resolve());
  });
}

function isValidPassword(password) {
  if (password.length < 8) return 'ความยาวต้องไม่น้อยกว่า 8 ตัวอักษร';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return 'ต้องมีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข';
  if (!/[!@#$%^&*]/.test(password)) return 'ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%^&*)';
  return null;
}

function readLine(prompt, silent) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (silent) {
      let buffer = '';
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (char) => {
        char = String(char);
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(buffer.trim());
        } else if (char === '\u0003') {
          process.exit(130);
        } else if (char === '\u007f' || char === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          buffer += char;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function ask(prompt, silent) {
  if (isPiped) {
    return pipedLines.shift() ?? '';
  }
  return readLine(prompt, silent);
}

async function main() {
  await pipedReady;
  await initDB();
  console.log('\nสร้างบัญชี Super Admin (Asset Management)\n');

  const username = await ask('Username: ');
  const email = await ask('Email: ');
  const fullName = await ask('ชื่อ-นามสกุล (full name): ');
  const password = await ask('Password: ', true);
  const confirm = await ask('ยืนยัน Password: ', true);

  if (!username || !password) {
    console.log('ยกเลิก: ยังไม่ได้กรอก Username/Password');
    process.exit(1);
  }
  if (password !== confirm) {
    console.log('ยกเลิก: Password ไม่ตรงกัน');
    process.exit(1);
  }
  const pwErr = isValidPassword(password);
  if (pwErr) {
    console.log('ยกเลิก: Password ไม่ถูกต้อง — ' + pwErr);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  const [existing] = await pool.query('SELECT id, username, role FROM users WHERE username = ?', [username]);
  if (existing.length > 0) {
    const ans = await ask(`User "${username}" (role=${existing[0].role}) มีอยู่แล้ว — ต้องการเลื่อนเป็น Super Admin หรือไม่? (y/N): `);
    if (ans.toLowerCase() !== 'y') {
      console.log('ยกเลิก');
      process.exit(0);
    }
    await pool.query(`UPDATE users SET role = 'super_admin', email_verified = 1 WHERE id = ?`, [existing[0].id]);
    console.log('สำเร็จ: เลื่อนผู้ใช้ "' + username + '" เป็น Super Admin แล้ว');
  } else {
    await pool.query(
      `INSERT INTO users (username, email, password, full_name, role, email_verified) VALUES (?, ?, ?, ?, 'super_admin', 1)`,
      [username, email || null, hashed, fullName || null]
    );
    console.log('สำเร็จ: สร้าง Super Admin "' + username + '" แล้ว (เข้าสู่ระบบได้ทันที)');
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});