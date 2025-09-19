import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Download, Settings, CheckCircle2, XCircle, AlertCircle, LogOut, Edit, UserCheck, Shield, User, BarChart3, Plus, Trash2, UserPlus, Key, Wifi, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';

const AttendanceSystem = () => {
  // 系统状态
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');

  // 用户数据 - 添加数据持久化
  const [users, setUsers] = useState(() => {
    const savedUsers = localStorage.getItem('attendanceUsers');
    return savedUsers ? JSON.parse(savedUsers) : [
      {
        id: 1,
        username: 'admin',
        password: btoa('admin123'), // 简单编码
        role: 'admin',
        name: '系统管理员',
        department: '管理部',
        allowedIPs: ['192.168.110.11', '192.168.110.100', '127.0.0.1']
      },
      {
        id: 2,
        username: 'zhangsan',
        password: btoa('123456'),
        role: 'employee',
        name: '张三',
        department: '设计部',
        allowedIPs: ['192.168.110.11']
      },
      {
        id: 3,
        username: 'lisi',
        password: btoa('123456'),
        role: 'employee',
        name: '李四',
        department: '工程部',
        allowedIPs: ['192.168.110.12']
      },
      {
        id: 4,
        username: 'wangwu',
        password: btoa('123456'),
        role: 'employee',
        name: '王五',
        department: '技术部',
        allowedIPs: ['192.168.110.13']
      },
      {
        id: 5,
        username: 'zhaoliu',
        password: btoa('123456'),
        role: 'employee',
        name: '赵六',
        department: '项目部',
        allowedIPs: ['192.168.110.14']
      },
      {
        id: 6,
        username: 'qianqi',
        password: btoa('123456'),
        role: 'employee',
        name: '钱七',
        department: '质量部',
        allowedIPs: ['192.168.110.15']
      }
    ];
  });

  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    const savedRecords = localStorage.getItem('attendanceRecords');
    return savedRecords ? JSON.parse(savedRecords) : {};
  });

  const [userIP, setUserIP] = useState('192.168.110.11');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    name: '',
    department: '',
    role: 'employee',
    allowedIPs: []
  });
  const [newIP, setNewIP] = useState('');

  const employees = users.filter(user => user.role === 'employee');

  // 数据持久化
  useEffect(() => {
    localStorage.setItem('attendanceUsers', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  // CSS样式对象
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
    cardSmall: {
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      padding: '1.5rem',
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
      transition: 'background-color 0.2s',
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    buttonPurple: {
      backgroundColor: '#7c3aed',
      color: 'white',
      padding: '0.5rem 1rem',
      borderRadius: '0.375rem',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    buttonGreen: {
      backgroundColor: '#10b981',
      color: 'white',
      padding: '0.5rem 1rem',
      borderRadius: '0.375rem',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
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
    buttonTextGray: {
      backgroundColor: 'transparent',
      color: '#6b7280',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem'
    },
    buttonIcon: {
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '0.25rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '0.375rem',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxSizing: 'border-box'
    },
    select: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid #d1d5db',
      borderRadius: '0.375rem',
      fontSize: '1rem',
      outline: 'none',
      backgroundColor: 'white',
      boxSizing: 'border-box'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.875rem'
    },
    th: {
      textAlign: 'left',
      padding: '0.75rem',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb',
      fontWeight: '500'
    },
    td: {
      padding: '0.75rem',
      borderBottom: '1px solid #e5e7eb'
    },
    badge: {
      padding: '0.25rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: '500',
      display: 'inline-block'
    },
    adminBadge: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    employeeBadge: {
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    successBadge: {
      backgroundColor: '#dcfce7',
      color: '#166534'
    },
    errorBadge: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    ipBadge: {
      fontSize: '0.75rem',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.25rem',
      fontFamily: 'monospace',
      marginRight: '0.25rem',
      marginBottom: '0.25rem',
      display: 'inline-block'
    },
    ipBadgeActive: {
      backgroundColor: '#dcfce7',
      color: '#166534'
    },
    ipBadgeInactive: {
      backgroundColor: '#f3f4f6',
      color: '#6b7280'
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
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem',
      marginBottom: '1.5rem'
    },
    gridCols2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '1rem',
      zIndex: 1000
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 20px 25px rgba(0, 0, 0, 0.1)',
      padding: '1.5rem',
      width: '100%',
      maxWidth: '500px',
      maxHeight: '80vh',
      overflowY: 'auto'
    },
    message: {
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      padding: '1rem',
      borderRadius: '0.375rem',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      border: '1px solid',
      zIndex: 1001
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

  // 消息提示函数
  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const generateDatesForMonth = (year, month) => {
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push({
        date: `${month}月${day}日`,
        dateObj: new Date(year, month - 1, day)
      });
    }
    return dates;
  };

  const currentMonth = currentTime.getMonth() + 1;
  const currentYear = currentTime.getFullYear();
  const monthDates = generateDatesForMonth(currentYear, currentMonth);

  const checkUserIPAccess = (user, ip) => {
    return user.allowedIPs.includes(ip);
  };

  const handleLogin = () => {
    const user = users.find(u =>
      u.username === loginForm.username &&
      u.password === btoa(loginForm.password)
    );

    if (!user) {
      showMessage('用户名或密码错误', 'error');
      return;
    }

    if (!checkUserIPAccess(user, userIP)) {
      showMessage(`访问被拒绝：用户 ${user.name} 未被授权在IP ${userIP} 登录`, 'error');
      return;
    }

    setCurrentUser(user);
    setCurrentView(user.role === 'admin' ? 'admin' : 'checkin');
    showMessage('登录成功！', 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
    setLoginForm({ username: '', password: '' });
    showMessage('已安全退出', 'success');
  };

  const resetUserForm = () => {
    setUserForm({
      username: '',
      password: '',
      name: '',
      department: '',
      role: 'employee',
      allowedIPs: []
    });
    setNewIP('');
    setEditingUser(null);
    setShowUserForm(false);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    resetUserForm();
    setShowUserForm(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      password: atob(user.password), // 解码显示
      name: user.name,
      department: user.department,
      role: user.role,
      allowedIPs: [...user.allowedIPs]
    });
    setShowUserForm(true);
  };

  const handleSaveUser = () => {
    // 表单验证
    if (!userForm.username || !userForm.password || !userForm.name || !userForm.department) {
      showMessage('请填写所有必填字段', 'error');
      return;
    }

    if (userForm.username.length < 3) {
      showMessage('用户名至少需要3个字符', 'error');
      return;
    }

    if (userForm.password.length < 6) {
      showMessage('密码至少需要6个字符', 'error');
      return;
    }

    if (userForm.allowedIPs.length === 0) {
      showMessage('请至少添加一个允许的IP地址', 'error');
      return;
    }

    const existingUser = users.find(u => u.username === userForm.username && u.id !== editingUser?.id);
    if (existingUser) {
      showMessage('用户名已存在', 'error');
      return;
    }

    const userData = {
      ...userForm,
      password: btoa(userForm.password) // 编码存储
    };

    if (editingUser) {
      setUsers(prev => prev.map(user =>
        user.id === editingUser.id
          ? { ...user, ...userData }
          : user
      ));
      showMessage('用户信息更新成功', 'success');
    } else {
      const newUser = {
        ...userData,
        id: Math.max(...users.map(u => u.id)) + 1
      };
      setUsers(prev => [...prev, newUser]);
      showMessage('用户添加成功', 'success');
    }

    resetUserForm();
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('确定要删除这个用户吗？')) {
      setUsers(prev => prev.filter(user => user.id !== userId));
      showMessage('用户删除成功', 'success');
    }
  };

  const handleResetPassword = (userId) => {
    const newPassword = '123456';
    if (window.confirm(`确定要重置该用户密码为：${newPassword}？`)) {
      setUsers(prev => prev.map(user =>
        user.id === userId
          ? { ...user, password: btoa(newPassword) }
          : user
      ));
      showMessage('密码重置成功，新密码：123456', 'success');
    }
  };

  const addIPToUser = () => {
    if (newIP && !userForm.allowedIPs.includes(newIP)) {
      setUserForm(prev => ({
        ...prev,
        allowedIPs: [...prev.allowedIPs, newIP]
      }));
      setNewIP('');
    }
  };

  const removeIPFromUser = (ip) => {
    setUserForm(prev => ({
      ...prev,
      allowedIPs: prev.allowedIPs.filter(allowedIP => allowedIP !== ip)
    }));
  };

  const handleCheckIn = () => {
    if (!currentUser) {
      showMessage('请先登录', 'error');
      return;
    }

    if (!checkUserIPAccess(currentUser, userIP)) {
      showMessage('签到失败：您未被授权在当前IP签到', 'error');
      return;
    }

    const today = `${currentMonth}月${currentTime.getDate()}日`;
    const timeStr = currentTime.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const recordKey = `${currentUser.name}-${today}`;

    if (attendanceRecords[recordKey]) {
      showMessage('今日已签到，无需重复签到', 'warning');
      return;
    }

    setAttendanceRecords(prev => ({
      ...prev,
      [recordKey]: {
        userId: currentUser.id,
        employee: currentUser.name,
        department: currentUser.department,
        date: today,
        time: timeStr,
        ip: userIP,
        timestamp: currentTime.toISOString()
      }
    }));

    showMessage(`签到成功！时间：${timeStr}`, 'success');
  };

  const exportToExcel = () => {
    try {
      const worksheetData = [];

      worksheetData.push([`乌兰察布项目 ${currentYear}年${currentMonth}月考勤表`]);
      worksheetData.push([]);

      const headers = ['考勤日期'];
      employees.forEach(emp => headers.push(emp.name));
      worksheetData.push(headers);

      monthDates.forEach(dateInfo => {
        const row = [dateInfo.date];

        employees.forEach(emp => {
          const recordKey = `${emp.name}-${dateInfo.date}`;
          const record = attendanceRecords[recordKey];
          row.push(record ? record.time : '');
        });

        worksheetData.push(row);
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      worksheet['!cols'] = [
        { width: 12 },
        ...employees.map(() => ({ width: 12 }))
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      const fileName = `考勤表_${currentYear}年${currentMonth}月.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showMessage('考勤表导出成功！', 'success');
    } catch (error) {
      console.error('导出错误:', error);
      showMessage('导出失败，请重试', 'error');
    }
  };

  const getStats = () => {
    const today = `${currentMonth}月${currentTime.getDate()}日`;
    const todayRecords = Object.values(attendanceRecords).filter(record => record.date === today);
    const totalEmployees = employees.length;
    const checkedInCount = todayRecords.length;
    const attendanceRate = totalEmployees > 0 ? Math.round((checkedInCount / totalEmployees) * 100) : 0;

    return { todayRecords, totalEmployees, checkedInCount, attendanceRate };
  };

  const getCurrentIPUsers = () => {
    return users.filter(user => user.allowedIPs.includes(userIP));
  };

  const stats = getStats();
  const currentIPUsers = getCurrentIPUsers();

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
                账号IP绑定签到系统
              </h1>
              <p style={{color: '#6b7280', marginTop: '0.5rem'}}>请使用授权账号登录</p>
            </div>

            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem'
            }}>
              <div style={styles.flexCenter}>
                <Wifi size={16} color="#2563eb" style={{marginRight: '0.5rem'}} />
                <span style={{fontSize: '0.875rem', fontWeight: '500', color: '#1e3a8a'}}>
                  当前访问IP:
                </span>
                <span style={{fontFamily: 'monospace', fontSize: '0.875rem', color: '#1e40af', marginLeft: '0.5rem'}}>
                  {userIP}
                </span>
              </div>
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
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              style={{...styles.button, width: '100%', marginBottom: '1rem', justifyContent: 'center'}}
            >
              安全登录
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

            <div style={{marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', textAlign: 'center'}}>
              <p style={{fontSize: '0.75rem', color: '#6b7280'}}>
                系统采用账号IP绑定验证，确保访问安全
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 用户管理页面
  if (currentView === 'userManagement') {
    return (
      <div style={styles.container}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div style={styles.card}>
            <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <div style={{
                  backgroundColor: '#7c3aed',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  marginRight: '0.75rem'
                }}>
                  <UserPlus size={24} color="white" />
                </div>
                <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>用户与IP管理</h1>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <button
                  onClick={() => setCurrentView('admin')}
                  style={styles.buttonTextGray}
                >
                  返回后台
                </button>
                <button
                  onClick={handleLogout}
                  style={styles.buttonText}
                >
                  <LogOut size={16} />
                  退出
                </button>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{...styles.flexBetween, marginBottom: '1.5rem'}}>
              <h2 style={{fontSize: '1.25rem', fontWeight: '600', margin: 0}}>用户列表与IP授权</h2>
              <button
                onClick={handleAddUser}
                style={styles.button}
              >
                <Plus size={16} />
                添加用户
              </button>
            </div>

            <div style={{overflowX: 'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>用户名</th>
                    <th style={styles.th}>姓名</th>
                    <th style={styles.th}>部门</th>
                    <th style={styles.th}>角色</th>
                    <th style={styles.th}>授权IP地址</th>
                    <th style={styles.th}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={{...styles.td, fontFamily: 'monospace'}}>{user.username}</td>
                      <td style={{...styles.td, fontWeight: '500'}}>{user.name}</td>
                      <td style={styles.td}>{user.department}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          ...(user.role === 'admin' ? styles.adminBadge : styles.employeeBadge)
                        }}>
                          {user.role === 'admin' ? '管理员' : '员工'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.25rem'}}>
                          {user.allowedIPs.map((ip, index) => (
                            <span
                              key={index}
                              style={{
                                ...styles.ipBadge,
                                ...(ip === userIP ? styles.ipBadgeActive : styles.ipBadgeInactive)
                              }}
                            >
                              {ip}
                              {ip === userIP && <span style={{marginLeft: '0.25rem'}}>●</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={{...styles.buttonIcon, color: '#2563eb'}}
                            title="编辑用户"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            style={{...styles.buttonIcon, color: '#d97706'}}
                            title="重置密码"
                          >
                            <Key size={16} />
                          </button>
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              style={{...styles.buttonIcon, color: '#dc2626'}}
                              title="删除用户"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showUserForm && (
            <div style={styles.modal}>
              <div style={styles.modalContent}>
                <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
                  <h3 style={{fontSize: '1.125rem', fontWeight: '600', margin: 0}}>
                    {editingUser ? '编辑用户' : '添加用户'}
                  </h3>
                  <button
                    onClick={resetUserForm}
                    style={{...styles.buttonIcon, color: '#6b7280'}}
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <div style={{marginBottom: '1rem'}}>
                  <div style={styles.gridCols2}>
                    <div>
                      <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                        用户名
                      </label>
                      <input
                        type="text"
                        value={userForm.username}
                        onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                        style={styles.input}
                        placeholder="请输入用户名"
                        disabled={editingUser}
                      />
                    </div>

                    <div>
                      <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                        密码
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                        style={styles.input}
                        placeholder="请输入密码"
                      />
                    </div>
                  </div>
                </div>

                <div style={{marginBottom: '1rem'}}>
                  <div style={styles.gridCols2}>
                    <div>
                      <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                        姓名
                      </label>
                      <input
                        type="text"
                        value={userForm.name}
                        onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                        style={styles.input}
                        placeholder="请输入姓名"
                      />
                    </div>

                    <div>
                      <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                        部门
                      </label>
                      <input
                        type="text"
                        value={userForm.department}
                        onChange={(e) => setUserForm(prev => ({ ...prev, department: e.target.value }))}
                        style={styles.input}
                        placeholder="请输入部门"
                      />
                    </div>
                  </div>
                </div>

                <div style={{marginBottom: '1rem'}}>
                  <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                    角色
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                    style={styles.select}
                  >
                    <option value="employee">员工</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>

                <div style={{marginBottom: '1rem'}}>
                  <label style={{display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem'}}>
                    授权IP地址 <span style={{color: '#dc2626'}}>*</span>
                  </label>

                  <div style={{marginBottom: '0.75rem'}}>
                    {userForm.allowedIPs.map((ip, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        padding: '0.5rem',
                        borderRadius: '0.25rem',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{fontFamily: 'monospace', fontSize: '0.875rem'}}>{ip}</span>
                        <button
                          onClick={() => removeIPFromUser(ip)}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#dc2626',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                    {userForm.allowedIPs.length === 0 && (
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        textAlign: 'center',
                        padding: '0.5rem'
                      }}>
                        尚未添加任何IP地址
                      </div>
                    )}
                  </div>

                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input
                      type="text"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                      style={{...styles.input, flex: 1}}
                      placeholder="输入IP地址，如: 192.168.1.100"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addIPToUser();
                        }
                      }}
                    />
                    <button
                      onClick={addIPToUser}
                      style={styles.button}
                    >
                      添加
                    </button>
                  </div>
                  <p style={{fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem'}}>
                    用户只能在授权的IP地址上登录
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  marginTop: '1rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <button
                    onClick={resetUserForm}
                    style={styles.buttonTextGray}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUser}
                    style={styles.button}
                  >
                    {editingUser ? '保存' : '添加'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div style={{
              ...styles.message,
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

  // 管理员后台页面
  if (currentView === 'admin') {
    return (
      <div style={styles.container}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
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
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>欢迎，{currentUser.name} (IP: {userIP})</p>
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <button
                  onClick={() => setCurrentView('userManagement')}
                  style={styles.buttonPurple}
                >
                  <UserPlus size={16} />
                  用户管理
                </button>
                <button
                  onClick={handleLogout}
                  style={styles.buttonText}
                >
                  <LogOut size={16} />
                  退出
                </button>
              </div>
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
                <span style={{fontSize: '0.875rem', color: '#6b7280'}}>安全等级: 高</span>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.cardSmall}>
              <div style={styles.flexBetween}>
                <div>
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>总员工数</p>
                  <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: 0}}>{stats.totalEmployees}</p>
                </div>
                <div style={{backgroundColor: '#dbeafe', padding: '0.75rem', borderRadius: '50%'}}>
                  <Users size={24} color="#2563eb" />
                </div>
              </div>
            </div>

            <div style={styles.cardSmall}>
              <div style={styles.flexBetween}>
                <div>
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>今日签到</p>
                  <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: 0}}>{stats.checkedInCount}</p>
                </div>
                <div style={{backgroundColor: '#dcfce7', padding: '0.75rem', borderRadius: '50%'}}>
                  <UserCheck size={24} color="#10b981" />
                </div>
              </div>
            </div>

            <div style={styles.cardSmall}>
              <div style={styles.flexBetween}>
                <div>
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>签到率</p>
                  <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed', margin: 0}}>{stats.attendanceRate}%</p>
                </div>
                <div style={{backgroundColor: '#ede9fe', padding: '0.75rem', borderRadius: '50%'}}>
                  <BarChart3 size={24} color="#7c3aed" />
                </div>
              </div>
            </div>

            <div style={styles.cardSmall}>
              <div style={styles.flexBetween}>
                <div>
                  <p style={{fontSize: '0.875rem', color: '#6b7280', margin: 0}}>在线IP数</p>
                  <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b', margin: 0}}>{currentIPUsers.length}</p>
                </div>
                <div style={{backgroundColor: '#fef3c7', padding: '0.75rem', borderRadius: '50%'}}>
                  <Wifi size={24} color="#f59e0b" />
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{...styles.flexBetween, marginBottom: '1rem'}}>
              <h2 style={{fontSize: '1.25rem', fontWeight: '600', margin: 0}}>今日签到详情</h2>
              <button
                onClick={exportToExcel}
                style={styles.buttonGreen}
              >
                <Download size={16} />
                导出考勤表
              </button>
            </div>

            <div style={{overflowX: 'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>员工姓名</th>
                    <th style={styles.th}>部门</th>
                    <th style={styles.th}>签到时间</th>
                    <th style={styles.th}>签到IP</th>
                    <th style={styles.th}>授权状态</th>
                    <th style={styles.th}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const today = `${currentMonth}月${currentTime.getDate()}日`;
                    const recordKey = `${emp.name}-${today}`;
                    const record = attendanceRecords[recordKey];

                    return (
                      <tr key={emp.id}>
                        <td style={{...styles.td, fontWeight: '500'}}>{emp.name}</td>
                        <td style={styles.td}>{emp.department}</td>
                        <td style={styles.td}>{record ? record.time : '-'}</td>
                        <td style={{...styles.td, fontFamily: 'monospace', fontSize: '0.75rem'}}>{record ? record.ip : '-'}</td>
                        <td style={styles.td}>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.25rem'}}>
                            {emp.allowedIPs.map((ip, index) => (
                              <span
                                key={index}
                                style={{
                                  ...styles.ipBadge,
                                  ...(ip === userIP ? styles.ipBadgeActive : styles.ipBadgeInactive)
                                }}
                              >
                                {ip}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {record ? (
                            <span style={{...styles.badge, ...styles.successBadge}}>
                              已签到
                            </span>
                          ) : (
                            <span style={{...styles.badge, ...styles.errorBadge}}>
                              未签到
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {message && (
            <div style={{
              ...styles.message,
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

  // 员工签到页面
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
            <button
              onClick={handleLogout}
              style={styles.buttonText}
            >
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
              justifyContent: 'center'
            }}
          >
            立即签到
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
              <div style={{color: '#6b7280'}}>
                今日状态：
              </div>
              {(() => {
                const today = `${currentMonth}月${currentTime.getDate()}日`;
                const recordKey = `${currentUser.name}-${today}`;
                const record = attendanceRecords[recordKey];
                return record ? (
                  <span style={{...styles.badge, ...styles.successBadge}}>
                    已签到 {record.time}
                  </span>
                ) : (
                  <span style={{...styles.badge, ...styles.errorBadge}}>
                    未签到
                  </span>
                );
              })()}
            </div>

            <div style={{
              padding: '0.75rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem'
            }}>
              <p style={{fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.5rem'}}>您的授权IP地址:</p>
              <div style={{...styles.flexCenter, flexWrap: 'wrap', gap: '0.5rem'}}>
                {currentUser.allowedIPs.map((ip, index) => (
                  <span
                    key={index}
                    style={{
                      ...styles.ipBadge,
                      ...(ip === userIP ? styles.ipBadgeActive : styles.ipBadgeInactive)
                    }}
                  >
                    {ip}
                    {ip === userIP && <span style={{marginLeft: '0.25rem'}}>●</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSystem