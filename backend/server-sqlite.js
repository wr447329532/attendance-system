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
    ? true
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

    let filebuffer;
    try {
      filebuffer = fs.readFileSync(dbPath);
      console.log('读取现有数据库文件');
    } catch (err) {
      console.log('数据库文件不存在，创建新数据库');
      filebuffer = null;
    }

    db = new SQL.Database(filebuffer);
    console.log('SQLite 数据库连接成功');

    createTables();
    insertDefaultData();
    saveDatabase();

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
    console.log('数据库已保存到文件');
  } catch (error) {
    console.error('保存数据库失败:', error);
  }
}

// 创建数据库表
function createTables() {
  try {
    console.log('开始创建数据库表...');

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

    db.exec(createUsersTable);
    console.log('✓ users 表创建成功');

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

    db.exec(createAttendanceTable);
    console.log('✓ attendance_records 表创建成功');

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('创建的表:', tables[0] ? tables[0].values.flat() : '无表');

  } catch (error) {
    console.error('创建表失败:', error);
    throw error;
  }
}

// 插入默认数据
function insertDefaultData() {
  try {
    console.log('开始插入默认数据...');

    const checkResult = db.exec('SELECT COUNT(*) as count FROM users');
    const userCount = checkResult[0] ? checkResult[0].values[0][0] : 0;

    if (userCount > 0) {
      console.log(`默认用户数据已存在 (${userCount} 个用户)，跳过创建`);
      return;
    }

    const realIP = getRealLocalIP();
    console.log(`当前检测到的本机IP: ${realIP}`);

    const insertSQL = `
      INSERT INTO users (username, password, role, name, department, allowed_ips) VALUES
      ('admin', '${hashPassword('admin123')}', 'admin', '系统管理员', '管理部', '["*"]'),
      ('zhangsan', '${hashPassword('123456')}', 'employee', '张三', '设计部', '["192.168.220.1", "127.0.0.1", "::1", "${realIP}"]'),
      ('lisi', '${hashPassword('123456')}', 'employee', '李四', '工程部', '["192.168.220.1", "127.0.0.1", "::1", "${realIP}"]');
    `;

    db.exec(insertSQL);
    console.log('✓ 默认用户数据插入完成');

    const verifyResult = db.exec('SELECT username, name, department, role FROM users');
    if (verifyResult[0] && verifyResult[0].values) {
      console.log('数据库中的用户列表:');
      const columns = verifyResult[0].columns;
      verifyResult[0].values.forEach(row => {
        const user = {};
        columns.forEach((col, index) => {
          user[col] = row[index];
        });
        console.log(`  - ${user.name} (${user.username}) - ${user.department} - ${user.role}`);
      });
    }

  } catch (error) {
    console.error('插入默认数据失败:', error);
    throw error;
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

// 管理员权限检查中间件
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// IP 检查中间件
const checkIPAccess = (req, res, next) => {
  const clientIp = req.clientIp;

  try {
    const result = db.exec('SELECT allowed_ips FROM users WHERE id = ?', [req.user.id]);

    if (!result[0] || !result[0].values.length) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const allowedIpsStr = result[0].values[0][0];
    const allowedIps = JSON.parse(allowedIpsStr);

    if (allowedIps.includes('*')) {
      req.clientIp = clientIp;
      next();
      return;
    }

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
    console.error('IP检查错误:', error);
    res.status(500).json({ error: 'IP检查失败' });
  }
};

// 添加数据库就绪检查中间件
const ensureDatabaseReady = (req, res, next) => {
  if (!db) {
    return res.status(503).json({
      error: '数据库未就绪，请稍后重试',
      service_unavailable: true
    });
  }
  next();
};

// 在需要数据库的路由前添加检查
app.use('/api/login', ensureDatabaseReady);
app.use('/api/checkin', ensureDatabaseReady);
app.use('/api/admin', ensureDatabaseReady);
app.use('/api/debug', ensureDatabaseReady);

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

    console.log(`登录尝试: ${username}, IP: ${clientIp}`);

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const result = db.exec(`
      SELECT id, username, password, role, name, department, allowed_ips
      FROM users WHERE username = ?
    `, [username]);

    if (!result[0] || !result[0].values.length) {
      console.log(`用户不存在: ${username}`);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const userRow = result[0].values[0];
    const columns = result[0].columns;
    const user = {};
    columns.forEach((col, index) => {
      user[col] = userRow[index];
    });

    const isValidPassword = verifyPassword(password, user.password);
    if (!isValidPassword) {
      console.log(`密码错误: ${username}`);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const allowedIps = JSON.parse(user.allowed_ips);

    if (!allowedIps.includes('*') && !allowedIps.includes(clientIp)) {
      console.log(`IP未授权: ${clientIp}, 允许的IP: ${JSON.stringify(allowedIps)}`);
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

    console.log(`登录成功: ${user.name} (${username})`);

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
    const userResult = db.exec('SELECT name, department FROM users WHERE id = ?', [userId]);

    if (!userResult[0] || !userResult[0].values.length) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const userName = userResult[0].values[0][0];
    const userDept = userResult[0].values[0][1];

    const existingResult = db.exec(`
      SELECT id FROM attendance_records WHERE user_id = ? AND check_date = ?
    `, [userId, today]);

    if (existingResult[0] && existingResult[0].values.length > 0) {
      return res.status(409).json({
        error: '今日已签到，无需重复签到',
        already_checked: true
      });
    }

    db.exec(`
      INSERT INTO attendance_records
      (user_id, employee_name, department, check_date, check_time, ip_address, auto_detected)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, userName, userDept, today, currentTime, clientIp, 1]);

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
    const result = db.exec(`
      SELECT check_time FROM attendance_records WHERE user_id = ? AND check_date = ?
    `, [userId, today]);

    const checkedIn = result[0] && result[0].values.length > 0;
    const checkinTime = checkedIn ? result[0].values[0][0] : null;

    res.json({
      checked_in: checkedIn,
      checkin_time: checkinTime,
      date: today
    });
  } catch (error) {
    console.error('查询签到状态错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 获取考勤统计
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const totalResult = db.exec(`SELECT COUNT(*) as count FROM users WHERE role = 'employee'`);
    const totalCount = totalResult[0] ? totalResult[0].values[0][0] : 0;

    const checkedResult = db.exec(`SELECT COUNT(*) as count FROM attendance_records WHERE check_date = ?`, [today]);
    const checkedCount = checkedResult[0] ? checkedResult[0].values[0][0] : 0;

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

// 管理员 - 获取用户列表
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const result = db.exec('SELECT id, username, name, department, role, allowed_ips, created_at FROM users ORDER BY created_at DESC');

    let users = [];
    if (result[0] && result[0].values) {
      const columns = result[0].columns;
      users = result[0].values.map(row => {
        const user = {};
        columns.forEach((col, index) => {
          user[col] = row[index];
        });
        // 解析 allowed_ips JSON
        try {
          user.allowed_ips = JSON.parse(user.allowed_ips || '[]');
        } catch (e) {
          user.allowed_ips = [];
        }
        return user;
      });
    }

    res.json({
      message: '获取用户列表成功',
      users: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 创建新用户
app.post('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { username, password, name, department, role = 'employee', allowed_ips = [] } = req.body;

    // 验证必填字段
    if (!username || !password || !name || !department) {
      return res.status(400).json({ error: '用户名、密码、姓名和部门为必填项' });
    }

    // 检查用户名是否已存在
    const existingResult = db.exec('SELECT id FROM users WHERE username = ?', [username]);
    if (existingResult[0] && existingResult[0].values.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 创建新用户
    const hashedPassword = hashPassword(password);
    const allowedIpsJson = JSON.stringify(allowed_ips);

    db.exec(`
      INSERT INTO users (username, password, role, name, department, allowed_ips)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [username, hashedPassword, role, name, department, allowedIpsJson]);

    saveDatabase();

    // 获取创建的用户信息
    const newUserResult = db.exec('SELECT id, username, name, department, role, allowed_ips, created_at FROM users WHERE username = ?', [username]);

    let newUser = null;
    if (newUserResult[0] && newUserResult[0].values.length > 0) {
      const columns = newUserResult[0].columns;
      const userRow = newUserResult[0].values[0];
      newUser = {};
      columns.forEach((col, index) => {
        newUser[col] = userRow[index];
      });
      try {
        newUser.allowed_ips = JSON.parse(newUser.allowed_ips || '[]');
      } catch (e) {
        newUser.allowed_ips = [];
      }
    }

    console.log(`管理员 ${req.user.username} 创建了新用户: ${name} (${username})`);

    res.json({
      message: '用户创建成功',
      user: newUser
    });

  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 更新用户
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, password, name, department, role, allowed_ips } = req.body;

    // 验证用户是否存在
    const existingResult = db.exec('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (!existingResult[0] || !existingResult[0].values.length) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查新用户名是否与其他用户冲突
    if (username) {
      const conflictResult = db.exec('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (conflictResult[0] && conflictResult[0].values.length > 0) {
        return res.status(409).json({ error: '用户名已被其他用户使用' });
      }
    }

    // 构建更新语句
    const updateFields = [];
    const updateValues = [];

    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (password) {
      updateFields.push('password = ?');
      updateValues.push(hashPassword(password));
    }
    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (department) {
      updateFields.push('department = ?');
      updateValues.push(department);
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (allowed_ips !== undefined) {
      updateFields.push('allowed_ips = ?');
      updateValues.push(JSON.stringify(allowed_ips));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(userId);

    const updateSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    db.exec(updateSQL, updateValues);
    saveDatabase();

    console.log(`管理员 ${req.user.username} 更新了用户 ID: ${userId}`);

    res.json({
      message: '用户更新成功'
    });

  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 删除用户
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // 防止删除管理员自己
    if (userId === req.user.id) {
      return res.status(400).json({ error: '不能删除自己的账户' });
    }

    // 验证用户是否存在
    const existingResult = db.exec('SELECT id, username, name FROM users WHERE id = ?', [userId]);
    if (!existingResult[0] || !existingResult[0].values.length) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const userName = existingResult[0].values[0][2]; // name字段

    // 删除用户相关的考勤记录
    db.exec('DELETE FROM attendance_records WHERE user_id = ?', [userId]);

    // 删除用户
    db.exec('DELETE FROM users WHERE id = ?', [userId]);

    saveDatabase();

    console.log(`管理员 ${req.user.username} 删除了用户: ${userName} (ID: ${userId})`);

    res.json({
      message: '用户删除成功'
    });

  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 获取考勤记录
app.get('/api/admin/records', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { startDate, endDate, employee } = req.query;

    let sql = 'SELECT * FROM attendance_records WHERE 1=1';
    let params = [];

    if (startDate) {
      sql += ' AND check_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND check_date <= ?';
      params.push(endDate);
    }

    if (employee) {
      sql += ' AND employee_name LIKE ?';
      params.push(`%${employee}%`);
    }

    sql += ' ORDER BY check_date DESC, check_time DESC';

    const result = db.exec(sql, params);

    let records = [];
    if (result[0] && result[0].values) {
      const columns = result[0].columns;
      records = result[0].values.map(row => {
        const record = {};
        columns.forEach((col, index) => {
          record[col] = row[index];
        });
        return record;
      });
    }

    res.json({
      message: '获取考勤记录成功',
      records: records
    });

  } catch (error) {
    console.error('获取考勤记录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 导出考勤记录（设计院格式）
app.get('/api/admin/export', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { year, month } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || (new Date().getMonth() + 1);

    // 计算该月的开始和结束日期
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]; // 该月最后一天

    console.log(`导出考勤记录: ${startDate} 到 ${endDate}`);

    // 获取该月的所有考勤记录
    const recordsResult = db.exec(`
      SELECT employee_name, check_date, check_time
      FROM attendance_records
      WHERE check_date BETWEEN ? AND ?
      ORDER BY employee_name, check_date
    `, [startDate, endDate]);

    // 获取所有员工
    const employeesResult = db.exec(`
      SELECT name FROM users WHERE role = 'employee' ORDER BY name
    `);

    let employees = [];
    if (employeesResult[0] && employeesResult[0].values) {
      employees = employeesResult[0].values.map(row => row[0]);
    }

    // 处理考勤数据
    let records = [];
    if (recordsResult[0] && recordsResult[0].values) {
      const columns = recordsResult[0].columns;
      records = recordsResult[0].values.map(row => {
        const record = {};
        columns.forEach((col, index) => {
          record[col] = row[index];
        });
        return record;
      });
    }

    // 获取该月天数
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 构建设计院考勤表格式数据
    const exportData = {
      title: '乌兰察布项目单位考勤表',
      year: currentYear,
      month: currentMonth,
      employees: employees,
      days: daysInMonth,
      records: records,
      dateRange: {
        startDate,
        endDate
      }
    };

    console.log(`导出成功: 员工数量 ${employees.length}, 记录数量 ${records.length}`);

    res.json({
      message: '导出数据生成成功',
      data: exportData
    });

  } catch (error) {
    console.error('导出考勤记录失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// 调试端点 - 查看所有用户（仅开发环境）
app.get('/api/debug/users', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    console.log('尝试查询用户数据...');

    if (!db) {
      console.error('数据库连接不存在');
      return res.status(500).json({ error: '数据库连接不存在' });
    }

    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    const tableExists = tablesResult[0] && tablesResult[0].values.length > 0;
    console.log('users表是否存在:', tableExists);

    if (!tableExists) {
      return res.status(500).json({
        error: 'users表不存在',
        suggestion: '请重启服务器重新初始化数据库'
      });
    }

    const result = db.exec('SELECT id, username, name, department, role, allowed_ips FROM users');

    let users = [];
    if (result[0] && result[0].values) {
      const columns = result[0].columns;
      users = result[0].values.map(row => {
        const user = {};
        columns.forEach((col, index) => {
          user[col] = row[index];
        });
        return user;
      });
    }

    console.log('查询到的用户数量:', users.length);

    res.json({
      message: '数据库用户列表',
      total: users.length,
      users: users
    });
  } catch (error) {
    console.error('调试查询错误:', error);
    res.status(500).json({
      error: '查询失败',
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// 添加数据库状态检查端点
app.get('/api/debug/db-status', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const dbExists = db ? true : false;
    const fileExists = fs.existsSync(dbPath);

    let tables = [];
    let userCount = 0;

    if (db) {
      try {
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        if (tablesResult[0] && tablesResult[0].values) {
          tables = tablesResult[0].values.map(row => row[0]);
        }

        const countResult = db.exec('SELECT COUNT(*) as count FROM users');
        if (countResult[0] && countResult[0].values) {
          userCount = countResult[0].values[0][0];
        }
      } catch (e) {
        console.error('查询表信息失败:', e);
      }
    }

    res.json({
      database: {
        connected: dbExists,
        file_path: dbPath,
        file_exists: fileExists
      },
      tables: tables,
      user_count: userCount,
      real_ip: getRealLocalIP()
    });
  } catch (error) {
    console.error('数据库状态检查失败:', error);
    res.status(500).json({
      error: '状态检查失败',
      details: error.message
    });
  }
});

// 启动服务器
async function startServer() {
  try {
    await initDatabase();

    const realIP = getRealLocalIP();

    app.listen(PORT, HOST, () => {
      console.log(`\n=== 考勤系统服务启动成功 ===`);
      console.log(`服务器运行在: http://${HOST}:${PORT}`);
      console.log(`API接口地址: http://${HOST}:${PORT}/api`);
      console.log(`SQLite数据库文件: ${dbPath}`);
      console.log(`检测到的本机IP: ${realIP}`);
      console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n=== 默认登录账户 ===`);
      console.log(`管理员: admin / admin123`);
      console.log(`员工: zhangsan / 123456`);
      console.log(`员工: lisi / 123456`);
      console.log(`\n=== API接口列表 ===`);
      console.log(`用户管理: GET/POST/PUT/DELETE /api/admin/users`);
      console.log(`考勤记录: GET /api/admin/records`);
      console.log(`数据导出: GET /api/admin/export`);
      console.log(`数据库状态: GET /api/debug/db-status`);
      console.log(`查看用户: GET /api/debug/users`);
      console.log(`获取IP: GET /api/ip`);
      console.log(`======================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();