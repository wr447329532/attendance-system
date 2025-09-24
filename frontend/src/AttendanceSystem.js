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
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminView, setAdminView] = useState('dashboard'); // dashboard, records, employees, departments, users

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
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  };

  // 获取服务器检测的IP地址
  const fetchUserIP = useCallback(async () => {
    setIsLoading(true);
    setIpStatus('正在从服务器获取本机IP地址...');

    try {
      const data = await apiRequest('/ip');
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
      // 通过获取签到状态来验证 token
      await apiRequest('/checkin/status');
      // 如果成功，获取用户信息（从 token 解析或通过 API）
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
      const data = await apiRequest('/checkin/status');
      setCheckinStatus(data);
    } catch (error) {
      console.error('获取签到状态失败:', error);
    }
  }, [currentUser]);

  // 获取管理员统计数据
  const fetchAdminStats = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/admin/stats');
      setAdminStats(data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, [currentUser]);

  // 获取员工列表
  const fetchEmployees = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/admin/employees');
      setEmployees(data.employees);
    } catch (error) {
      console.error('获取员工列表失败:', error);
    }
  }, [currentUser]);

  // 获取考勤记录
  const fetchAttendanceRecords = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/admin/records');
      setAttendanceRecords(data.records);
    } catch (error) {
      console.error('获取考勤记录失败:', error);
    }
  }, [currentUser]);

  // 获取部门统计
  const fetchDepartments = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/admin/departments');
      setDepartments(data.departments);
    } catch (error) {
      console.error('获取部门统计失败:', error);
    }
  }, [currentUser]);

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const data = await apiRequest('/admin/users');
      setUsers(data.users);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  }, [currentUser]);

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
        await apiRequest('/admin/users', {
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

  // 删除用户
  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`确定要删除用户"${userName}"吗？此操作不可撤销！`)) {
      return;
    }

    try {
      await apiRequest(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      showMessage('用户删除成功', 'success');
      fetchUsers(); // 刷新列表
    } catch (error) {
      showMessage(error.message, 'error');
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
      allowed_ips: user.allowed_ips
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

  // 删除考勤记录
  const deleteRecord = async (recordId) => {
    try {
      await apiRequest(`/admin/records/${recordId}`, {
        method: 'DELETE'
      });
      showMessage('记录删除成功', 'success');
      fetchAttendanceRecords(); // 刷新列表
    } catch (error) {
      showMessage(error.message, 'error');
    }
  };

  // 导出考勤记录（设计院考勤表格式）
  const exportRecords = () => {
    if (attendanceRecords.length === 0) {
      showMessage('暂无数据可导出', 'warning');
      return;
    }

    // 获取当前月份
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 获取本月所有员工
    const employeeNames = [...new Set(attendanceRecords.map(record => record.employee_name))];

    // 获取本月天数
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 构建设计院考勤表格式
    const csvData = [];

    // 标题行
    csvData.push(['乌兰察布项目公司考勤表']);

    // 表头：考勤月度、考勤日期、各员工姓名（每个员工两列：上午、下午）
    const headerRow1 = ['考勤月度', '考勤日期'];
    const headerRow2 = ['', ''];

    employeeNames.forEach(name => {
      headerRow1.push(name, ''); // 员工姓名占两列
      headerRow2.push('上午', '下午'); // 第二行显示上午/下午
    });

    csvData.push(headerRow1);
    csvData.push(headerRow2);

    // 按日期生成每一行
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const monthDayStr = `${currentMonth}月`;
      const dayStr = `${day}日`;

      // 每一行：月份、日期、各员工当天的签到时间
      const row = [monthDayStr, dayStr];

      // 为每个员工添加当天的签到时间（上午、下午）
      employeeNames.forEach(employeeName => {
        const dayRecord = attendanceRecords.find(record =>
          record.employee_name === employeeName && record.check_date === dateStr
        );

        if (dayRecord) {
          const checkTime = dayRecord.check_time;
          const hour = parseInt(checkTime.split(':')[0]);

          // 根据签到时间判断是上午还是下午
          if (hour < 12) {
            // 上午签到
            row.push(checkTime, ''); // 上午有时间，下午空白
          } else {
            // 下午签到
            row.push('', checkTime); // 上午空白，下午有时间
          }
        } else {
          // 没有签到记录
          row.push('', ''); // 上午下午都空白
        }
      });

      csvData.push(row);
    }

    // 统计行
    const attendanceRow = ['出勤天数', ''];
    const leaveRow = ['请假天数', ''];
    const absentRow = ['旷工天数', ''];

    employeeNames.forEach(name => {
      const attendanceDays = attendanceRecords.filter(record => record.employee_name === name).length;
      attendanceRow.push(attendanceDays, ''); // 出勤天数只显示在第一列
      leaveRow.push('0', ''); // 请假天数
      absentRow.push(daysInMonth - attendanceDays, ''); // 旷工天数
    });

    csvData.push(attendanceRow);
    csvData.push(leaveRow);
    csvData.push(absentRow);

    // 签名行
    const signRow = ['项目负责人确认：', ''];
    employeeNames.forEach(() => {
      signRow.push('', '');
    });
    csvData.push(signRow);

    // 转换为CSV格式
    const csvContent = csvData.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // 创建下载
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `乌兰察布项目公司考勤表_${currentYear}年${currentMonth}月.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessage('设计院考勤表导出成功', 'success');
  };

  // 导出员工信息
  const exportEmployees = () => {
    if (employees.length === 0) {
      showMessage('暂无员工数据可导出', 'warning');
      return;
    }

    // 准备CSV数据
    const headers = ['员工姓名', '用户名', '部门', '今日签到状态', '累计签到次数', '出勤天数', '授权IP'];
    const csvData = [
      headers,
      ...employees.map(employee => [
        employee.name,
        employee.username,
        employee.department,
        employee.checked_today ? '已签到' : '未签到',
        employee.total_checkins,
        employee.days_attended,
        employee.allowed_ips.join('; ')
      ])
    ];

    // 转换为CSV格式
    const csvContent = csvData.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    // 添加BOM以支持中文
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // 创建下载
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `员工信息_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessage('员工信息导出成功', 'success');
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
    fetchCheckinStatus();
    fetchAdminStats();
    fetchAttendanceRecords();
    fetchUsers();
  }, [fetchCheckinStatus, fetchAdminStats, fetchAttendanceRecords, fetchUsers]);

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
    setTimeout(() => setMessage(''), 3000);
  };

  // 处理登录
  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/login', {
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
      const data = await apiRequest('/checkin', {
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
                乌兰察布项目公司签到系统
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
                placeholder="请输入用户名"
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
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && userIP && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              style={{...styles.button, width: '100%', marginBottom: '1rem', justifyContent: 'center'}}
              disabled={isLoading || !userIP}
            >
              {isLoading ? '登录中...' : !userIP ? 'IP检测中，请稍候...' : '安全登录'}
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

            <div style={{marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', textAlign: 'center'}}>
              <p style={{fontSize: '0.75rem', color: '#6b7280'}}>
                系统通过服务器检测本机IP地址进行身份验证
              </p>
            </div>
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

            {message && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '0.375rem',
                ...(messageType === 'success' ? styles.messageSuccess :
                   messageType === 'error' ? styles.messageError : styles.messageWarning)
              }}>
                {message}
              </div>
            )}

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
        </div>
      </div>
    );
  }

  // 管理员页面
  if (currentView === 'admin') {
    return (
      <div style={styles.container}>
        <div style={{maxWidth: '1400px', margin: '0 auto'}}>
          {/* 头部导航 */}
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

            {/* 导航标签 */}
            <div style={{display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem'}}>
              {[
                { key: 'dashboard', label: '数据概览', icon: '📊' },
                { key: 'records', label: '考勤记录', icon: '📋' },
                { key: 'users', label: '账号管理', icon: '⚙️' }
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

          {/* 数据概览 */}
          {adminView === 'dashboard' && (
            <>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem'}}>
                <div style={{backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0'}}>
                  <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5rem'}}>
                    <Users size={20} color="#64748b" />
                    <span style={{fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem'}}>总员工数</span>
                  </div>
                  <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>
                    {adminStats.total_employees || 0}
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
            </>
          )}

          {/* 考勤记录 */}
          {adminView === 'records' && (
            <div style={styles.card}>
              <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
                <h3 style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>考勤记录</h3>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button
                    onClick={exportRecords}
                    style={{
                      ...styles.button,
                      backgroundColor: '#059669'
                    }}
                  >
                    <span style={{fontSize: '1rem'}}>📥</span>
                    导出Excel
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
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{padding: '2rem', textAlign: 'center', color: '#6b7280'}}>
                          暂无考勤记录
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map(record => (
                        <tr key={record.id} style={{borderBottom: '1px solid #f3f4f6'}}>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#1f2937'}}>{record.employee_name}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{record.department}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{record.check_date}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280'}}>{record.check_time}</td>
                          <td style={{padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280'}}>{record.ip_address}</td>
                          <td style={{padding: '0.75rem'}}>
                            <button
                              onClick={() => {
                                if (window.confirm('确定要删除这条记录吗？')) {
                                  deleteRecord(record.id);
                                }
                              }}
                              style={{
                                ...styles.buttonSmall,
                                backgroundColor: '#dc2626',
                                fontSize: '0.75rem'
                              }}
                            >
                              <XCircle size={12} />
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 账号管理 */}
          {adminView === 'users' && (
            <div style={styles.card}>
              <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
                <h3 style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>账号管理</h3>
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
                  <button onClick={fetchUsers} style={styles.button}>
                    <RefreshCw size={16} />
                    刷新
                  </button>
                </div>
              </div>

              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb'}}>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>用户名</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>姓名</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>部门</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>角色</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>授权IP</th>
                      <th style={{padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151'}}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{padding: '2rem', textAlign: 'center', color: '#6b7280'}}>
                          暂无用户数据
                        </td>
                      </tr>
                    ) : (
                      users.map(user => (
                        <tr key={user.id} style={{borderBottom: '1px solid #f3f4f6'}}>
                          <td style={{padding: '0.75rem', fontSize: '0.875rem', color: '#1f2937', fontFamily: 'monospace'}}>{user.username}</td>
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
                            {user.allowed_ips.join(', ')}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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
                        >
                          <option value="employee">员工</option>
                          <option value="admin">管理员</option>
                        </select>
                      </div>

                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                          授权IP地址 (多个IP用逗号分隔)
                        </label>
                        <input
                          type="text"
                          value={userForm.allowed_ips.join(', ')}
                          onChange={(e) => setUserForm(prev => ({
                            ...prev,
                            allowed_ips: e.target.value.split(',').map(ip => ip.trim()).filter(ip => ip)
                          }))}
                          style={styles.input}
                          placeholder="192.168.1.100, 192.168.1.101"
                        />
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
            </div>
          )}

          {/* 消息提示 */}
          {message && (
            <div style={{
              position: 'fixed',
              top: '1rem',
              right: '1rem',
              padding: '1rem',
              borderRadius: '0.375rem',
              zIndex: 1000,
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