const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const os = require('os');

// 简单密码处理函数
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

const app = express();

// 端口配置
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true  // 允许所有来源，或者指定具体域名
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// 健康检查端点
app.get('/', (req, res) => {
  res.status(200).json({
    message: '考勤系统API服务运行中',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 获取真实的本机 IP 地址
function getRealLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        if (iface.address.startsWith('192.168.')) {
          return iface.address;
        }
        if (iface.address.startsWith('10.')) {
          return iface.address;
        }
        if (iface.address.startsWith('172.')) {
          const secondOctet = parseInt(iface.address.split('.')[1]);
          if (secondOctet >= 16 && secondOctet <= 31) {
            return iface.address;
          }
        }
      }
    }
  }
  return '127.0.0.1';
}

// 自定义IP检测中间件
app.use((req, res, next) => {
  let clientIp = getRealLocalIP();

  if (req.headers['x-forwarded-for']) {
    clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
  } else if (req.headers['x-real-ip']) {
    clientIp = req.headers['x-real-ip'];
  } else if (req.connection && req.connection.remoteAddress) {
    const remoteIp = req.connection.remoteAddress;
    if (remoteIp !== '::1' && remoteIp !== '127.0.0.1' && !remoteIp.includes('::ffff:127.0.0.1')) {
      clientIp = remoteIp.replace('::ffff:', '');
    }
  }

  req.clientIp = clientIp;
  next();
});

// SQLite数据库
const dbPath = path.join(__dirname, 'attendance.db');
let db;

// 初始化数据库
async function initDatabase() {
  try {
    const SQL = await initSqlJs();

    // 尝试读取现有数据库文件
    let filebuffer;
    try {
      filebuffer = fs.readFileSync(dbPath);
    } catch (err) {
      // 文件不存在，创建新数据库
      filebuffer = null;
    }

    db = new SQL.Database(filebuffer);
    console.log('SQLite 数据库连接成功');

    createTables();
    await insertDefaultData();
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
}

// 保存数据库到文件
function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('保存数据库失败:', error);
  }
}

// 创建数据库表
function createTables() {
  // 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      allowed_ips TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建考勤记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT NOT NULL,
      check_date DATE NOT NULL,
      check_time TIME NOT NULL,
      ip_address TEXT NOT NULL,
      auto_detected BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, check_date)
    )
  `);

  console.log('数据库表创建完成');
}

// 插入默认数据
async function insertDefaultData() {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get();

    if (result.count > 0) {
      console.log('默认用户数据已存在');
      return;
    }

    const realIP = getRealLocalIP();

    const defaultUsers = [
      {
        username: 'admin',
        password: hashPassword('admin123'),
        role: 'admin',
        name: '系统管理员',
        department: '管理部',
        allowed_ips: JSON.stringify(['*', realIP])
      },
      {
        username: 'zhangsan',
        password: hashPassword('123456'),
        role: 'employee',
        name: '张三',
        department: '设计部',
        allowed_ips: JSON.stringify(['192.168.220.1', '127.0.0.1', '::1', realIP])
      },
      {
        username: 'lisi',
        password: hashPassword('123456'),
        role: 'employee',
        name: '李四',
        department: '工程部',
        allowed_ips: JSON.stringify(['192.168.220.1', '127.0.0.1', '::1', realIP])
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO users (username, password, role, name, department, allowed_ips)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    defaultUsers.forEach(user => {
      insertStmt.run([
        user.username, user.password, user.role,
        user.name, user.department, user.allowed_ips
      ]);
    });

    saveDatabase();
    console.log('默认用户数据插入完成');
    console.log(`检测到的本机IP: ${realIP}`);
  } catch (error) {
    console.error('插入默认数据失败:', error);
  }
}

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: '访问令牌无效' });
    }
    req.user = user;
    next();
  });
};

// IP 检查中间件
const checkIPAccess = (req, res, next) => {
  const clientIp = req.clientIp;

  try {
    const stmt = db.prepare('SELECT allowed_ips FROM users WHERE id = ?');
    const user = stmt.get([req.user.id]);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const allowedIps = JSON.parse(user.allowed_ips);
    if (!allowedIps.includes(clientIp)) {
      return res.status(403).json({
        error: `访问被拒绝：IP ${clientIp} 未被授权`,
        clientIp,
        allowedIps
      });
    }

    req.clientIp = clientIp;
    next();
  } catch (error) {
    res.status(500).json({ error: 'IP检查失败' });
  }
};

// API 路由

// 获取客户端 IP 地址
app.get('/api/ip', (req, res) => {
  const clientIp = req.clientIp;
  const realIP = getRealLocalIP();

  res.json({
    ip: clientIp,
    detected_real_ip: realIP,
    message: '成功获取客户端IP地址'
  });
});

// 用户登录
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.clientIp;

    const stmt = db.prepare(`
      SELECT id, username, password, role, name, department, allowed_ips
      FROM users WHERE username = ?
    `);
    const user = stmt.get([username]);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValidPassword = verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const allowedIps = JSON.parse(user.allowed_ips);
    if (!allowedIps.includes(clientIp)) {
      return res.status(403).json({
        error: `访问被拒绝：用户 ${user.name} 未被授权在IP ${clientIp} 登录`,
        clientIp,
        allowedIps
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      'your-secret-key',
      { expiresIn: '8h' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        department: user.department,
        role: user.role
      },
      clientIp
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户签到
app.post('/api/checkin', authenticateToken, checkIPAccess, (req, res) => {
  const userId = req.user.id;
  const clientIp = req.clientIp;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];

  try {
    const userStmt = db.prepare('SELECT name, department FROM users WHERE id = ?');
    const user = userStmt.get([userId]);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const existingStmt = db.prepare(`
      SELECT id FROM attendance_records WHERE user_id = ? AND check_date = ?
    `);
    const existingRecord = existingStmt.get([userId, today]);

    if (existingRecord) {
      return res.status(409).json({
        error: '今日已签到，无需重复签到',
        already_checked: true
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO attendance_records
      (user_id, employee_name, department, check_date, check_time, ip_address, auto_detected)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run([userId, user.name, user.department, today, currentTime, clientIp, 1]);
    saveDatabase();

    res.json({
      message: '签到成功',
      checkin_time: currentTime,
      checkin_date: today,
      ip_address: clientIp
    });
  } catch (error) {
    console.error('签到错误:', error);
    res.status(500).json({ error: '签到失败，服务器内部错误' });
  }
});

// 获取用户签到状态
app.get('/api/checkin/status', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const stmt = db.prepare(`
      SELECT check_time FROM attendance_records WHERE user_id = ? AND check_date = ?
    `);
    const record = stmt.get([userId, today]);

    res.json({
      checked_in: !!record,
      checkin_time: record ? record.check_time : null,
      date: today
    });
  } catch (error) {
    console.error('查询签到状态错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 获取考勤统计
app.get('/api/admin/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'employee'`);
    const totalEmployees = totalStmt.get();

    const checkedStmt = db.prepare(`SELECT COUNT(*) as count FROM attendance_records WHERE check_date = ?`);
    const checkedInToday = checkedStmt.get([today]);

    const totalCount = totalEmployees.count;
    const checkedCount = checkedInToday.count;
    const attendanceRate = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

    res.json({
      total_employees: totalCount,
      checked_in_today: checkedCount,
      attendance_rate: attendanceRate,
      date: today
    });
  } catch (error) {
    console.error('获取考勤统计错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();

    const realIP = getRealLocalIP();

    app.listen(PORT, HOST, () => {
      console.log(`服务器运行在 ${HOST}:${PORT}`);
      console.log(`API接口地址: http://${HOST}:${PORT}/api`);
      console.log(`SQLite数据库文件: ${dbPath}`);
      console.log(`检测到的本机IP: ${realIP}`);
      console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`默认账户：`);
      console.log(`   管理员: admin / admin123`);
      console.log(`   员工: zhangsan / 123456`);
      console.log(`   员工: lisi / 123456`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();