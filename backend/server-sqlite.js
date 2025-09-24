const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();

// 中间件
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

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

// Better-SQLite3 数据库
const dbPath = path.join(__dirname, 'attendance.db');
let db;

// 初始化数据库
function initDatabase() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    console.log('SQLite 数据库连接成功');

    createTables();
    insertDefaultData();
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
}

// 创建数据库表
function createTables() {
  // 创建用户表
  db.exec(`
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
  db.exec(`
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
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

    if (userCount.count > 0) {
      console.log('默认用户数据已存在');
      return;
    }

    const insertUser = db.prepare(`
      INSERT INTO users (username, password, role, name, department, allowed_ips)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const realIP = getRealLocalIP();

    const defaultUsers = [
      {
        username: 'admin',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        name: '系统管理员',
        department: '管理部',
        allowed_ips: JSON.stringify(['192.168.220.1', '192.168.110.100', '127.0.0.1', '::1', realIP])
      },
      {
        username: 'zhangsan',
        password: await bcrypt.hash('123456', 10),
        role: 'employee',
        name: '张三',
        department: '设计部',
        allowed_ips: JSON.stringify(['192.168.220.1', '127.0.0.1', '::1', realIP])
      },
      {
        username: 'lisi',
        password: await bcrypt.hash('123456', 10),
        role: 'employee',
        name: '李四',
        department: '工程部',
        allowed_ips: JSON.stringify(['192.168.220.1', '127.0.0.1', '::1', realIP])
      }
    ];

    const insertMany = db.transaction((users) => {
      for (const user of users) {
        insertUser.run(user.username, user.password, user.role, user.name, user.department, user.allowed_ips);
      }
    });

    insertMany(defaultUsers);
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

  const user = db.prepare('SELECT allowed_ips FROM users WHERE id = ?').get(req.user.id);

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
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.clientIp;

    const user = db.prepare(`
      SELECT id, username, password, role, name, department, allowed_ips
      FROM users WHERE username = ?
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
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

  const user = db.prepare('SELECT name, department FROM users WHERE id = ?').get(userId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const existingRecord = db.prepare(`
    SELECT id FROM attendance_records WHERE user_id = ? AND check_date = ?
  `).get(userId, today);

  if (existingRecord) {
    return res.status(409).json({
      error: '今日已签到，无需重复签到',
      already_checked: true
    });
  }

  try {
    const insertRecord = db.prepare(`
      INSERT INTO attendance_records
      (user_id, employee_name, department, check_date, check_time, ip_address, auto_detected)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertRecord.run(userId, user.name, user.department, today, currentTime, clientIp, 1);

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

  const record = db.prepare(`
    SELECT check_time FROM attendance_records WHERE user_id = ? AND check_date = ?
  `).get(userId, today);

  res.json({
    checked_in: !!record,
    checkin_time: record ? record.check_time : null,
    date: today
  });
});

// 管理员 - 获取考勤统计
app.get('/api/admin/stats', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const today = new Date().toISOString().split('T')[0];

  const totalEmployees = db.prepare(`
    SELECT COUNT(*) as count FROM users WHERE role = 'employee'
  `).get();

  const checkedInToday = db.prepare(`
    SELECT COUNT(*) as count FROM attendance_records WHERE check_date = ?
  `).get(today);

  const totalCount = totalEmployees.count;
  const checkedCount = checkedInToday.count;
  const attendanceRate = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  res.json({
    total_employees: totalCount,
    checked_in_today: checkedCount,
    attendance_rate: attendanceRate,
    date: today
  });
});

// 管理员 - 获取考勤记录列表
app.get('/api/admin/records', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const { date, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT
      ar.id,
      ar.employee_name,
      ar.department,
      ar.check_date,
      ar.check_time,
      ar.ip_address,
      ar.auto_detected,
      ar.created_at,
      u.username
    FROM attendance_records ar
    LEFT JOIN users u ON ar.user_id = u.id
  `;

  let params = [];

  if (date) {
    query += ' WHERE ar.check_date = ?';
    params.push(date);
  }

  query += ' ORDER BY ar.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const records = db.prepare(query).all(...params);

  // 获取总记录数
  let countQuery = 'SELECT COUNT(*) as total FROM attendance_records';
  let countParams = [];

  if (date) {
    countQuery += ' WHERE check_date = ?';
    countParams.push(date);
  }

  const totalCount = db.prepare(countQuery).get(...countParams);

  res.json({
    records,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount.total,
      pages: Math.ceil(totalCount.total / limit)
    }
  });
});

// 管理员 - 获取员工列表
app.get('/api/admin/employees', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const today = new Date().toISOString().split('T')[0];

  const employees = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.name,
      u.department,
      u.allowed_ips,
      u.created_at,
      CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END as checked_today,
      ar.check_time as today_checkin_time
    FROM users u
    LEFT JOIN attendance_records ar ON u.id = ar.user_id AND ar.check_date = ?
    WHERE u.role = 'employee'
    ORDER BY u.name
  `).all(today);

  // 为每个员工计算统计信息
  const employeesWithStats = employees.map(emp => {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_checkins,
        COUNT(DISTINCT check_date) as days_attended
      FROM attendance_records
      WHERE user_id = ?
    `).get(emp.id);

    return {
      ...emp,
      allowed_ips: JSON.parse(emp.allowed_ips || '[]'),
      total_checkins: stats.total_checkins,
      days_attended: stats.days_attended
    };
  });

  res.json({
    employees: employeesWithStats
  });
});

// 管理员 - 获取部门统计
app.get('/api/admin/departments', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const today = new Date().toISOString().split('T')[0];

  const departments = db.prepare(`
    SELECT
      u.department,
      COUNT(u.id) as total_employees,
      COUNT(ar.id) as checked_today,
      ROUND(CAST(COUNT(ar.id) AS FLOAT) / COUNT(u.id) * 100, 1) as attendance_rate
    FROM users u
    LEFT JOIN attendance_records ar ON u.id = ar.user_id AND ar.check_date = ?
    WHERE u.role = 'employee'
    GROUP BY u.department
    ORDER BY u.department
  `).all(today);

  res.json({
    departments
  });
});

// 管理员 - 删除考勤记录
app.delete('/api/admin/records/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  const recordId = req.params.id;

  try {
    const deleteRecord = db.prepare('DELETE FROM attendance_records WHERE id = ?');
    const result = deleteRecord.run(recordId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ message: '记录删除成功' });
  } catch (error) {
    console.error('删除记录错误:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 管理员 - 获取所有用户
app.get('/api/admin/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  try {
    const users = db.prepare(`
      SELECT id, username, role, name, department, allowed_ips, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    // 解析 JSON 格式的 allowed_ips
    const usersWithParsedIps = users.map(user => ({
      ...user,
      allowed_ips: JSON.parse(user.allowed_ips || '[]')
    }));

    res.json({ users: usersWithParsedIps });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 创建新用户
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  try {
    const { username, password, role, name, department, allowed_ips } = req.body;

    // 验证必填字段
    if (!username || !password || !name || !department) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入新用户
    const insertUser = db.prepare(`
      INSERT INTO users (username, password, role, name, department, allowed_ips)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertUser.run(
      username,
      hashedPassword,
      role || 'employee',
      name,
      department,
      JSON.stringify(allowed_ips || [])
    );

    res.json({
      message: '用户创建成功',
      user_id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 更新用户
app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  try {
    const userId = req.params.id;
    const { username, password, role, name, department, allowed_ips } = req.body;

    // 验证用户是否存在
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查用户名是否与其他用户冲突
    if (username) {
      const duplicateUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
      if (duplicateUser) {
        return res.status(409).json({ error: '用户名已被其他用户使用' });
      }
    }

    // 构建更新语句
    let updateFields = [];
    let updateValues = [];

    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (password) {
      updateFields.push('password = ?');
      updateValues.push(await bcrypt.hash(password, 10));
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (department) {
      updateFields.push('department = ?');
      updateValues.push(department);
    }
    if (allowed_ips) {
      updateFields.push('allowed_ips = ?');
      updateValues.push(JSON.stringify(allowed_ips));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(userId);

    const updateUser = db.prepare(`
      UPDATE users SET ${updateFields.join(', ')} WHERE id = ?
    `);

    updateUser.run(...updateValues);

    res.json({ message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 管理员 - 删除用户
app.delete('/api/admin/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }

  try {
    const userId = req.params.id;

    // 防止删除自己
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    const result = deleteUser.run(userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 启动服务器
const PORT = 5000;

function startServer() {
  try {
    initDatabase();

    const realIP = getRealLocalIP();

    app.listen(PORT, () => {
      console.log(`✅ 服务器运行在端口 ${PORT}`);
      console.log(`🌐 API接口地址: http://localhost:${PORT}/api`);
      console.log(`💾 SQLite数据库文件: ${dbPath}`);
      console.log(`🖥️  检测到的本机IP: ${realIP}`);
      console.log(`\n🎯 默认账户：`);
      console.log(`   管理员: admin / admin123`);
      console.log(`   员工: zhangsan / 123456`);
      console.log(`   员工: lisi / 123456`);
      console.log(`\n💡 所有用户已自动添加本机IP (${realIP}) 到白名单`);
      console.log(`\n🔗 管理员功能接口：`);
      console.log(`   GET /api/admin/stats - 考勤统计`);
      console.log(`   GET /api/admin/records - 考勤记录`);
      console.log(`   GET /api/admin/employees - 员工列表`);
      console.log(`   GET /api/admin/departments - 部门统计`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();