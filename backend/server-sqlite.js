const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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
    ? ['https://your-frontend-domain.onrender.com']
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
  } else if (req.connection.remoteAddress) {
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
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err);
        reject(err);
      } else {
        console.log('SQLite 数据库连接成功');
        createTables()
          .then(() => insertDefaultData())
          .then(() => resolve())
          .catch(reject);
      }
    });
  });
}

// 创建数据库表
function createTables() {
  return new Promise((resolve, reject) => {
    const createUsersTable = `
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
    `;

    const createAttendanceTable = `
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
    `;

    db.run(createUsersTable, (err) => {
      if (err) {
        reject(err);
      } else {
        db.run(createAttendanceTable, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('数据库表创建完成');
            resolve();
          }
        });
      }
    });
  });
}

// 插入默认数据
function insertDefaultData() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row.count > 0) {
        console.log('默认用户数据已存在');
        resolve();
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
          allowed_ips: JSON.stringify(['192.168.220.1', '192.168.110.100', '127.0.0.1', '::1', realIP])
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

      const insertUser = db.prepare(`
        INSERT INTO users (username, password, role, name, department, allowed_ips)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let completed = 0;
      defaultUsers.forEach(user => {
        insertUser.run(
          user.username, user.password, user.role,
          user.name, user.department, user.allowed_ips,
          (err) => {
            if (err) {
              reject(err);
            } else {
              completed++;
              if (completed === defaultUsers.length) {
                insertUser.finalize();
                console.log('默认用户数据插入完成');
                console.log(`检测到的本机IP: ${realIP}`);
                resolve();
              }
            }
          }
        );
      });
    });
  });
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

  db.get('SELECT allowed_ips FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库查询失败' });
    }

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    try {
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
  });
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

    db.get(`
      SELECT id, username, password, role, name, department, allowed_ips
      FROM users WHERE username = ?
    `, [username], (err, user) => {
      if (err) {
        return res.status(500).json({ error: '数据库查询失败' });
      }

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

  db.get('SELECT name, department FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库查询失败' });
    }

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    db.get(`
      SELECT id FROM attendance_records WHERE user_id = ? AND check_date = ?
    `, [userId, today], (err, existingRecord) => {
      if (err) {
        return res.status(500).json({ error: '数据库查询失败' });
      }

      if (existingRecord) {
        return res.status(409).json({
          error: '今日已签到，无需重复签到',
          already_checked: true
        });
      }

      db.run(`
        INSERT INTO attendance_records
        (user_id, employee_name, department, check_date, check_time, ip_address, auto_detected)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, user.name, user.department, today, currentTime, clientIp, 1], function(err) {
        if (err) {
          console.error('签到错误:', err);
          return res.status(500).json({ error: '签到失败，服务器内部错误' });
        }

        res.json({
          message: '签到成功',
          checkin_time: currentTime,
          checkin_date: today,
          ip_address: clientIp
        });
      });
    });
  });
});

// 启动服务器
function startServer() {
  initDatabase()
    .then(() => {
      const realIP = getRealLocalIP();

      app.listen(PORT, HOST, () => {
        console.log(`✅ 服务器运行在 ${HOST}:${PORT}`);
        console.log(`🌐 API接口地址: http://${HOST}:${PORT}/api`);
        console.log(`💾 SQLite数据库文件: ${dbPath}`);
        console.log(`🖥️  检测到的本机IP: ${realIP}`);
        console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`\n🎯 默认账户：`);
        console.log(`   管理员: admin / admin123`);
        console.log(`   员工: zhangsan / 123456`);
        console.log(`   员工: lisi / 123456`);
      });
    })
    .catch((error) => {
      console.error('启动失败:', error);
      process.exit(1);
    });
}

startServer();