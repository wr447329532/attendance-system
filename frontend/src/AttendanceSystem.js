import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Users, CheckCircle2, XCircle, LogOut, UserCheck, Shield, Lock, RefreshCw, Monitor } from 'lucide-react';

const AttendanceSystem = () => {
  // 系统状态
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');

  // IP相关状态
  const [userIP, setUserIP] = useState('');
  const [ipStatus, setIpStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 消息提示
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  // 登录表单
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // 管理员统计数据
  const [adminStats, setAdminStats] = useState({});

  // 管理员数据
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminView, setAdminView] = useState('dashboard');

  // 用户管理相关状态
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'employee',
    name: '',
    department: '',
    allowed_ips: []
  });

  // 签到状态
  const [checkinStatus, setCheckinStatus] = useState({ checked_in: false, checkin_time: null });

  // API 基础 URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // 获取存储的 token
  const getToken = () => localStorage.getItem('attendance_token');

  // 设置 token
  const setToken = (token) => {
    if (token) {
      localStorage.setItem('attendance_token', token);
    } else {
      localStorage.removeItem('attendance_token');
    }
  };

  // API 请求封装
  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`API请求: ${API_BASE}${endpoint}`, config);
      const response = await fetch(`${API_BASE}${endpoint}`, config);

      // 检查响应状态
      if (response.status === 401 || response.status === 403) {
        console.warn('认证失败，可能是Token过期');
        setToken(null);
        localStorage.removeItem('attendance_user');
        setCurrentUser(null);
        setCurrentView('login');
        showMessage('登录已过期，请重新登录', 'warning');
        throw new Error('认证失败，请重新登录');
      }

      const data = await response.json();
      console.log(`API响应: ${endpoint}`, data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API请求错误 ${endpoint}:`, error);

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('无法连接到服务器，请检查后端是否正在运行');
      }

      throw error;
    }
  };

  // 获取服务器检测的IP地址
  const fetchUserIP = useCallback(async () => {
    setIsLoading(true);
    setIpStatus('正在从服务器获取本机IP地址...');

    try {
      const data = await apiRequest('/api/ip');
      setUserIP(data.ip);
      setIpStatus(`服务器检测到IP: ${data.ip}`);
      console.log('[IP检测] 服务器获取成功:', data.ip);
    } catch (error) {
      console.error('[IP检测] 服务器获取失败:', error);
      setUserIP('');
      setIpStatus(`获取失败：${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 验证 token 并自动登录
  const validateToken = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      await apiRequest('/api/checkin/status');
      const userData = JSON.parse(localStorage.getItem('attendance_user'));
      if (userData) {
        setCurrentUser(userData);
        setCurrentView(userData.role === 'admin' ? 'admin' : 'checkin');
      }
    } catch (error) {
      console.log('Token 无效，需要重新登录');
      setToken(null);
      localStorage.removeItem('attendance_user');
    }
  }, []);

  // 获取签到状态
  const fetchCheckinStatus = useCallback(async () => {
    if (!currentUser || currentUser.role === 'admin') return;

    try {
      const data = await apiRequest('/api/checkin/status');
      setCheckinStatus(data);
    } catch (error) {
      console.error('获取签到状态失败:', error);
    }
  }, [currentUser]);

  // 获取管理员统计数据
  const fetchAdminStats = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/api/admin/stats');
      setAdminStats(data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setAdminStats({
        total_employees: users.filter(u => u.role === 'employee').length,
        checked_in_today: attendanceRecords.filter(r => r.check_date === new Date().toISOString().split('T')[0]).length,
        attendance_rate: 0
      });
    }
  }, [currentUser, users, attendanceRecords]);

  // 获取考勤记录
  const fetchAttendanceRecords = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/api/admin/records');
      setAttendanceRecords(data.records || []);
    } catch (error) {
      console.error('获取考勤记录失败:', error);
      setAttendanceRecords([]);
    }
  }, [currentUser]);

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      setIsLoading(true);
      // 优先使用管理员API
      const data = await apiRequest('/api/admin/users');
      setUsers(data.users || []);

    } catch (error) {
      console.error('获取用户列表失败，尝试备用接口:', error);
      // 备用：使用debug接口
      try {
        const data = await apiRequest('/api/debug/users');
        const usersData = data.users || [];
        const formattedUsers = usersData.map(user => ({
          ...user,
          allowed_ips: user.allowed_ips ? JSON.parse(user.allowed_ips) : []
        }));
        setUsers(formattedUsers);
      } catch (backupError) {
        console.error('备用接口也失败:', backupError);
        setUsers([]);
        showMessage('无法加载用户数据：' + backupError.message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // 删除用户
  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`确定要删除用户"${userName}"吗？此操作不可撤销！`)) {
      return;
    }

    try {
      setIsLoading(true);
      await apiRequest(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      showMessage('用户删除成功', 'success');
      fetchUsers(); // 刷新列表
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 编辑用户
  const editUser = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      password: '', // 密码字段留空
      role: user.role,
      name: user.name,
      department: user.department,
      allowed_ips: Array.isArray(user.allowed_ips) ? user.allowed_ips : []
    });
    setShowUserModal(true);
  };

  // 新增用户
  const addNewUser = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      password: '',
      role: 'employee',
      name: '',
      department: '',
      allowed_ips: [userIP] // 默认添加当前IP
    });
    setShowUserModal(true);
  };

  // 创建或更新用户
  const handleUserSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      if (editingUser) {
        // 更新用户
        await apiRequest(`/admin/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(userForm)
        });
        showMessage('用户更新成功', 'success');
      } else {
        // 创建新用户
        await apiRequest('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(userForm)
        });
        showMessage('用户创建成功', 'success');
      }

      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({
        username: '',
        password: '',
        role: 'employee',
        name: '',
        department: '',
        allowed_ips: []
      });

      fetchUsers(); // 刷新用户列表
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 导出考勤记录（Excel格式）
  const exportAttendanceRecords = async () => {
    try {
      setIsLoading(true);
      showMessage('正在导出Excel文件...', 'info');

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const data = await apiRequest(`/admin/export?year=${year}&month=${month}`);

      // 构建Excel格式的文件
      generateDesignInstituteExcel(data.data);
      showMessage('Excel导出成功', 'success');

    } catch (error) {
      console.error('导出失败:', error);
      showMessage('导出失败：' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成Excel格式的文件
  const generateDesignInstituteExcel = (exportData) => {
    const { title, year, month, employees, days, records } = exportData;

    // 构建Excel数据
    const worksheetData = [];

    // 标题行
    worksheetData.push([title]);
    worksheetData.push([]); // 空行

    // 表头行：考勤月度、考勤日期、各员工姓名
    const headerRow = ['考勤月度', '考勤日期'];
    employees.forEach(name => {
      headerRow.push(name);
    });
    worksheetData.push(headerRow);

    // 按日期生成每一行
    for (let day = 1; day <= days; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const monthStr = `${month}月`;
      const dayStr = `${day}日`;

      const row = [monthStr, dayStr];

      // 为每个员工添加当天的签到时间
      employees.forEach(employeeName => {
        const dayRecord = records.find(record =>
          record.employee_name === employeeName && record.check_date === dateStr
        );

        if (dayRecord) {
          row.push(dayRecord.check_time);
        } else {
          row.push(''); // 未签到
        }
      });

      worksheetData.push(row);
    }

    // 添加统计行
    worksheetData.push([]); // 空行

    const attendanceRow = ['出勤天数', ''];
    const absentRow = ['缺勤天数', ''];

    employees.forEach(name => {
      const attendanceDays = records.filter(record => record.employee_name === name).length;
      attendanceRow.push(attendanceDays);
      absentRow.push(days - attendanceDays);
    });

    worksheetData.push(attendanceRow);
    worksheetData.push(absentRow);

    // 签字行
    worksheetData.push([]);
    worksheetData.push(['项目负责人签字：', '', '日期：']);

    // 转换为CSV格式（Excel可以正确打开）
    const csvContent = worksheetData.map(row =>
      row.map(field => {
        // 处理包含逗号或换行的字段
        if (typeof field === 'string' && (field.includes(',') || field.includes('\n') || field.includes('"'))) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      }).join(',')
    ).join('\r\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // 创建下载
    const blob = new Blob([csvWithBOM], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `乌兰察布项目考勤表_${year}年${month}月.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchUserIP();
    validateToken();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchUserIP, validateToken]);

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchUsers();
      fetchAdminStats();
      fetchAttendanceRecords();
    } else if (currentUser) {
      fetchCheckinStatus();
    }
  }, [currentUser]);

  // CSS样式
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #ddd6fe 100%)',
      padding: '1rem'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      padding: '2rem',
      marginBottom: '1.5rem'
    },
    button: {
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '0.75rem 1rem',
      borderRadius: '0.375rem',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    buttonSmall: {
      backgroundColor: '#6b7280',
      color: 'white',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.25rem',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem'
    },
    buttonText: {
      backgroundColor: 'transparent',
      color: '#dc2626',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '0.375rem',
      fontSize: '1rem',
      outline: 'none',
      boxSizing: 'border-box'
    },
    badge: {
      padding: '0.25rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: '500',
      display: 'inline-block'
    },
    successBadge: {
      backgroundColor: '#dcfce7',
      color: '#166534'
    },
    errorBadge: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    flexBetween: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    flexCenter: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    messageSuccess: {
      backgroundColor: '#dcfce7',
      color: '#166534',
      borderColor: '#bbf7d0'
    },
    messageError: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      borderColor: '#fecaca'
    },
    messageWarning: {
      backgroundColor: '#fef3c7',
      color: '#92400e',
      borderColor: '#fde68a'
    }
  };

  // 消息提示
  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  // 处理登录
  const handleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('尝试登录:', loginForm.username, API_BASE);

      const data = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      setToken(data.token);
      localStorage.setItem('attendance_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setCurrentView(data.user.role === 'admin' ? 'admin' : 'checkin');
      showMessage('登录成功！', 'success');
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理登出
  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('attendance_user');
    setCurrentUser(null);
    setCurrentView('login');
    setLoginForm({ username: '', password: '' });
    showMessage('已安全退出', 'success');
  };

  // 处理签到
  const handleCheckIn = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/api/checkin', {
        method: 'POST',
      });

      setCheckinStatus({
        checked_in: true,
        checkin_time: data.checkin_time
      });

      showMessage(`签到成功！时间：${data.checkin_time}`, 'success');
    } catch (error) {
      if (error.message.includes('今日已签到')) {
        showMessage('今日已签到，无需重复签到', 'warning');
      } else {
        showMessage(error.message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 测试连接功能
  const testConnection = async () => {
    try {
      setIsLoading(true);
      showMessage('正在测试连接...', 'info');

      const ipData = await apiRequest('/api/ip');
      console.log('IP测试成功:', ipData);

      const userData = await apiRequest('/api/debug/users');
      console.log('用户数据测试成功:', userData);

      showMessage(`连接测试成功！发现 ${userData.users.length} 个用户`, 'success');
    } catch (error) {
      showMessage(`连接测试失败: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 登录页面
  if (currentView === 'login') {
    return (
      <div style={styles.container}>
        <div style={{...styles.flexCenter, minHeight: '100vh'}}>
          <div style={{...styles.card, width: '100%', maxWidth: '400px'}}>
            <div style={{textAlign: 'center', marginBottom: '2rem'}}>
              <div style={{
                backgroundColor: '#2563eb',
                padding: '0.75rem',
                borderRadius: '50%',
                width: '4rem',
                height: '4rem',
                margin: '0 auto 1rem',
                ...styles.flexCenter
              }}>
                <Lock size={32} color="white" />
              </div>
              <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem'}}>
                考勤系统
              </h1>
              <p style={{color: '#6b7280', marginTop: '0.5rem'}}>请使用授权账号登录</p>
            </div>

            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem',
              border: '1px solid #dbeafe'
            }}>
              <div style={{...styles.flexBetween, marginBottom: '0.5rem'}}>
                <div style={styles.flexCenter}>
                  <Monitor size={16} color="#2563eb" style={{marginRight: '0.5rem'}} />
                  <span style={{fontSize: '0.875rem', fontWeight: '500', color: '#1e3a8a'}}>
                    服务器IP检测
                  </span>
                </div>
                <button
                  onClick={fetchUserIP}
                  style={{
                    ...styles.buttonSmall,
                    backgroundColor: isLoading ? '#6b7280' : '#2563eb'
                  }}
                  disabled={isLoading}
                >
                  <RefreshCw size={12} />
                  {isLoading ? '检测中' : '重新检测'}
                </button>
              </div>

              <div style={{marginBottom: '0.5rem'}}>
                {isLoading ? (
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #dbeafe',
                      borderTop: '2px solid #2563eb',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span style={{fontSize: '0.875rem', color: '#6b7280'}}>
                      正在从服务器获取IP地址...
                    </span>
                  </div>
                ) : userIP ? (
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span style={{fontFamily: 'monospace', fontSize: '1rem', color: '#1e40af', fontWeight: 'bold'}}>
                      {userIP}
                    </span>
                  </div>
                ) : (
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <XCircle size={16} color="#dc2626" />
                    <span style={{fontSize: '0.875rem', color: '#dc2626'}}>
                      IP检测失败
                    </span>
                  </div>
                )}
              </div>

              {ipStatus && (
                <div style={{
                  fontSize: '0.75rem',
                  color: userIP ? '#059669' : '#dc2626',
                  marginBottom: '0.5rem'
                }}>
                  {ipStatus}
                </div>
              )}
            </div>

            <div style={{marginBottom: '1rem'}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                用户名
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                style={styles.input}
                placeholder="请输入用户名 (如: admin)"
              />
            </div>

            <div style={{marginBottom: '1rem'}}>
              <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                密码
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                style={styles.input}
                placeholder="请输入密码"
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              style={{...styles.button, width: '100%', marginBottom: '1rem', justifyContent: 'center'}}
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>

            {message && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                textAlign: 'center',
                ...(messageType === 'success' ? styles.messageSuccess :
                   messageType === 'error' ? styles.messageError : styles.messageWarning)
              }}>
                {message}
              </div>
            )}

            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  // 员工签到页面
  if (currentView === 'checkin') {
    return (
      <div style={styles.container}>
        <div style={{maxWidth: '600px', margin: '0 auto'}}>
          <div style={styles.card}>
            <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <div style={{
                  backgroundColor: '#2563eb',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  marginRight: '0.75rem'
                }}>
                  <Users size={24} color="white" />
                </div>
                <div>
                  <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>员工签到</h1>
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>欢迎，{currentUser.name} - {currentUser.department}</p>
                </div>
              </div>
              <button onClick={handleLogout} style={styles.buttonText}>
                <LogOut size={16} />
                退出
              </button>
            </div>

            <div style={styles.flexBetween}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#6b7280'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                  <Calendar size={16} />
                  <span>{currentTime.toLocaleDateString('zh-CN')}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                  <Clock size={16} />
                  <span>{currentTime.toLocaleTimeString('zh-CN')}</span>
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <span style={{fontSize: '0.875rem'}}>IP: {userIP}</span>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
            </div>
          </div>

          <div style={{...styles.card, textAlign: 'center'}}>
            <div style={{
              backgroundColor: '#dbeafe',
              padding: '1.5rem',
              borderRadius: '50%',
              width: '6rem',
              height: '6rem',
              margin: '0 auto 1.5rem',
              ...styles.flexCenter
            }}>
              <UserCheck size={48} color="#2563eb" />
            </div>

            <h2 style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem'}}>每日签到</h2>
            <p style={{color: '#6b7280', marginBottom: '1.5rem'}}>点击下方按钮完成今日签到</p>

            <button
              onClick={handleCheckIn}
              style={{
                ...styles.button,
                width: '100%',
                padding: '1rem 1.5rem',
                fontSize: '1.125rem',
                fontWeight: '600',
                justifyContent: 'center',
                backgroundColor: checkinStatus.checked_in ? '#6b7280' : '#2563eb'
              }}
              disabled={isLoading || checkinStatus.checked_in}
            >
              {isLoading ? '签到中...' : checkinStatus.checked_in ? '今日已签到' : '立即签到'}
            </button>

            <div style={{marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb'}}>
              <div style={{...styles.flexCenter, fontSize: '0.875rem', gap: '1rem', marginBottom: '1rem'}}>
                <div style={{color: '#6b7280'}}>今日状态：</div>
                {checkinStatus.checked_in ? (
                  <span style={{...styles.badge, ...styles.successBadge}}>
                    已签到 {checkinStatus.checkin_time}
                  </span>
                ) : (
                  <span style={{...styles.badge, ...styles.errorBadge}}>
                    未签到
                  </span>
                )}
              </div>
            </div>
          </div>

          {message && (
            <div style={{
              ...styles.card,
              ...(messageType === 'success' ? styles.messageSuccess :
                 messageType === 'error' ? styles.messageError : styles.messageWarning)
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 管理员页面
  if (currentView === 'admin') {
    return (
      <div style={styles.container}>
        <div style={{maxWidth: '1400px', margin: '0 auto'}}>
          <div style={styles.card}>
            <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <div style={{
                  backgroundColor: '#dc2626',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  marginRight: '0.75rem'
                }}>
                  <Shield size={24} color="white" />
                </div>
                <div>
                  <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>管理后台</h1>
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>
                    欢迎，{currentUser.name} (本机IP: {userIP})
                  </p>
                </div>
              </div>
              <button onClick={handleLogout} style={styles.buttonText}>
                <LogOut size={16} />
                退出
              </button>
            </div>

            <div style={{display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem'}}>
              {[
                { key: 'dashboard', label: '数据概览', icon: '📊' },
                { key: 'records', label: '考勤记录', icon: '📋' },
                { key: 'users', label: '用户管理', icon: '👥' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setAdminView(tab.key)}
                  style={{
                    ...styles.button,
                    backgroundColor: adminView === tab.key ? '#2563eb' : '#f3f4f6',
                    color: adminView === tab.key ? 'white' : '#6b7280',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem'
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          {adminView === 'dashboard' && (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem'}}>
              <div style={{backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0'}}>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5rem'}}>
                  <Users size={20} color="#64748b" />
                  <span style={{fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem'}}>总员工数</span>
                </div>
                <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>
                  {users.filter(u => u.role === 'employee').length || 0}
                </p>
              </div>
              <div style={{backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0'}}>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5rem'}}>
                  <CheckCircle2 size={20} color="#22c55e" />
                  <span style={{fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem'}}>今日签到</span>
                </div>
                <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: 0}}>
                  {adminStats.checked_in_today || 0}
                </p>
              </div>
              <div style={{backgroundColor: '#fdf4ff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e879f9'}}>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5rem'}}>
                  <span style={{fontSize: '1.25rem'}}>📈</span>
                  <span style={{fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem'}}>签到率</span>
                </div>
                <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed', margin: 0}}>
                  {adminStats.attendance_rate || 0}%
                </p>
              </div>
              <div style={{backgroundColor: '#fff7ed', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #fed7aa'}}>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5rem'}}>
                  <Calendar size={20} color="#ea580c" />
                  <span style={{fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem'}}>今日日期</span>
                </div>
                <p style={{fontSize: '1rem', fontWeight: 'bold', color: '#ea580c', margin: 0}}>
                  {new Date().toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
          )}

          {adminView === 'records' && (
            <div style={styles.card}>
              <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
                <h3 style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>考勤记录</h3>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button
                    onClick={exportAttendanceRecords}
                    style={{
                      ...styles.button,
                      backgroundColor: '#059669'
                    }}
                    disabled={isLoading}
                  >
                    <span style={{fontSize: '1rem'}}>📊</span>
                    {isLoading ? '导出中...' : '导出Excel'}
                  </button>
                  <button onClick={fetchAttendanceRecords} style={styles.button}>
                    <RefreshCw size={16} />
                    刷新
                  </button>
                </div>
              </div>

              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb'}}>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>员工姓名</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>部门</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>签到日期</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>签到时间</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>IP地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{padding: '2rem', textAlign: 'center', color: '#6b7280'}}>
                          暂无考勤记录
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((record, index) => (
                        <tr key={record.id || index} style={{borderBottom: '1px solid #f3f4f6'}}>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#1f2937'}}>{record.employee_name}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{record.department}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{record.check_date}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{record.check_time}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280'}}>{record.ip_address}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminView === 'users' && (
            <div style={styles.card}>
              <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
                <h3 style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>用户管理</h3>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button
                    onClick={addNewUser}
                    style={{
                      ...styles.button,
                      backgroundColor: '#059669'
                    }}
                  >
                    <span style={{fontSize: '1rem'}}>➕</span>
                    新增用户
                  </button>
                  <button
                    onClick={fetchUsers}
                    style={styles.button}
                    disabled={isLoading}
                  >
                    <RefreshCw size={16} />
                    {isLoading ? '加载中...' : '刷新用户列表'}
                  </button>
                </div>
              </div>

              {users.length === 0 ? (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  border: '2px dashed #d1d5db'
                }}>
                  <Users size={48} color="#9ca3af" style={{margin: '0 auto 1rem'}} />
                  <h3 style={{fontSize: '1.125rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem'}}>
                    无法加载用户数据
                  </h3>
                  <p style={{color: '#6b7280', marginBottom: '1rem'}}>
                    请检查后端连接或点击刷新重试
                  </p>
                  <button
                    onClick={fetchUsers}
                    style={{...styles.button, backgroundColor: '#059669'}}
                  >
                    <RefreshCw size={16} />
                    重新加载
                  </button>
                </div>
              ) : (
                <div style={{overflowX: 'auto'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr style={{backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb'}}>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>ID</th>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>用户名</th>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>姓名</th>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>部门</th>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>角色</th>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>授权IP</th>
                        <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, index) => (
                        <tr key={user.id || index} style={{borderBottom: '1px solid #f3f4f6'}}>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280', fontFamily: 'monospace'}}>{user.id}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#1f2937', fontFamily: 'monospace', fontWeight: '600'}}>{user.username}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#1f2937'}}>{user.name}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{user.department}</td>
                          <td style={{padding: '0.75rem'}}>
                            <span style={{
                              ...styles.badge,
                              ...(user.role === 'admin' ? {backgroundColor: '#fee2e2', color: '#991b1b'} : styles.successBadge)
                            }}>
                              {user.role === 'admin' ? '管理员' : '员工'}
                            </span>
                          </td>
                          <td style={{padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280'}}>
                            {Array.isArray(user.allowed_ips) ? user.allowed_ips.join(', ') : user.allowed_ips}
                          </td>
                          <td style={{padding: '0.75rem'}}>
                            <div style={{display: 'flex', gap: '0.25rem'}}>
                              <button
                                onClick={() => editUser(user)}
                                style={{
                                  ...styles.buttonSmall,
                                  backgroundColor: '#2563eb',
                                  fontSize: '0.75rem'
                                }}
                              >
                                ✏️ 编辑
                              </button>
                              {user.id !== currentUser.id && (
                                <button
                                  onClick={() => deleteUser(user.id, user.name)}
                                  style={{
                                    ...styles.buttonSmall,
                                    backgroundColor: '#dc2626',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  <XCircle size={12} />
                                  删除
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 用户编辑/新增模态框 */}
              {showUserModal && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000
                }}>
                  <div style={{
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    padding: '2rem',
                    width: '100%',
                    maxWidth: '500px',
                    maxHeight: '80vh',
                    overflowY: 'auto'
                  }}>
                    <h3 style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1.5rem'}}>
                      {editingUser ? '编辑用户' : '新增用户'}
                    </h3>

                    <form onSubmit={handleUserSubmit}>
                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          用户名 *
                        </label>
                        <input
                          type="text"
                          value={userForm.username}
                          onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                          style={styles.input}
                          placeholder="请输入用户名"
                          required
                          disabled={isLoading}
                        />
                      </div>

                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          密码 {editingUser && '(留空则不修改)'}
                        </label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                          style={styles.input}
                          placeholder={editingUser ? "留空则不修改密码" : "请输入密码"}
                          required={!editingUser}
                          disabled={isLoading}
                        />
                      </div>

                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          姓名 *
                        </label>
                        <input
                          type="text"
                          value={userForm.name}
                          onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                          style={styles.input}
                          placeholder="请输入真实姓名"
                          required
                          disabled={isLoading}
                        />
                      </div>

                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          部门 *
                        </label>
                        <input
                          type="text"
                          value={userForm.department}
                          onChange={(e) => setUserForm(prev => ({ ...prev, department: e.target.value }))}
                          style={styles.input}
                          placeholder="请输入部门名称"
                          required
                          disabled={isLoading}
                        />
                      </div>

                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          角色
                        </label>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                          style={styles.input}
                          disabled={isLoading}
                        >
                          <option value="employee">员工</option>
                          <option value="admin">管理员</option>
                        </select>
                      </div>

                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          授权IP地址 (多个IP用逗号分隔，使用 * 允许所有IP)
                        </label>
                        <input
                          type="text"
                          value={userForm.allowed_ips.join(', ')}
                          onChange={(e) => setUserForm(prev => ({
                            ...prev,
                            allowed_ips: e.target.value.split(',').map(ip => ip.trim()).filter(ip => ip)
                          }))}
                          style={styles.input}
                          placeholder="192.168.1.100, 192.168.1.101 或 *"
                          disabled={isLoading}
                        />
                        <div style={{fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem'}}>
                          当前检测到的IP: {userIP}
                        </div>
                      </div>

                      <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserModal(false);
                            setEditingUser(null);
                          }}
                          style={{
                            ...styles.button,
                            backgroundColor: '#6b7280'
                          }}
                          disabled={isLoading}
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          style={{
                            ...styles.button,
                            backgroundColor: '#059669'
                          }}
                          disabled={isLoading}
                        >
                          {isLoading ? '保存中...' : (editingUser ? '更新' : '创建')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#f0f9ff',
                borderRadius: '0.5rem',
                border: '1px solid #0ea5e9'
              }}>
                <h4 style={{fontSize: '0.875rem', fontWeight: '600', color: '#0369a1', marginBottom: '0.5rem'}}>
                  用户管理说明
                </h4>
                <div style={{fontSize: '0.75rem', color: '#0369a1'}}>
                  <p style={{margin: '0 0 0.5rem 0'}}>
                    • 可以创建新用户或编辑现有用户信息
                  </p>
                  <p style={{margin: '0 0 0.5rem 0'}}>
                    • 授权IP支持多个地址，用逗号分隔
                  </p>
                  <p style={{margin: '0'}}>
                    • 使用 * 可允许用户从任意IP地址登录
                  </p>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div style={{
              position: 'fixed',
              top: '1rem',
              right: '1rem',
              padding: '1rem',
              borderRadius: '0.375rem',
              zIndex: 1000,
              maxWidth: '400px',
              ...(messageType === 'success' ? styles.messageSuccess :
                 messageType === 'error' ? styles.messageError : styles.messageWarning)
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default AttendanceSystem;