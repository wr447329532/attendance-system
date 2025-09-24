-- 创建数据库
CREATE DATABASE IF NOT EXISTS attendance_system
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE attendance_system;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'employee') DEFAULT 'employee',
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    allowed_ips JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
);

-- 创建考勤记录表
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    check_date DATE NOT NULL,
    check_time TIME NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    auto_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_daily_checkin (user_id, check_date),
    INDEX idx_check_date (check_date),
    INDEX idx_user_id (user_id),
    INDEX idx_employee_name (employee_name)
);

-- 插入默认用户数据（密码已加密）
-- admin123 -> $2b$10$hash...
-- 123456 -> $2b$10$hash...

INSERT INTO users (username, password, role, name, department, allowed_ips) VALUES
('admin', '$2b$10$kEWGtYpPzPO2VLZvqjNiKeRfQHwVzXSzppQ7/G7Ae4nQZvN.p0.fW', 'admin', '系统管理员', '管理部', '["192.168.220.1", "192.168.110.100", "127.0.0.1"]'),
('zhangsan', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', '张三', '设计部', '["192.168.110.11"]'),
('lisi', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', '李四', '工程部', '["192.168.110.12"]')
ON DUPLICATE KEY UPDATE
username = VALUES(username);

-- 创建视图：每日考勤统计
CREATE OR REPLACE VIEW daily_attendance_stats AS
SELECT
    check_date,
    COUNT(*) as total_checkins,
    COUNT(DISTINCT department) as departments_count,
    MIN(check_time) as earliest_checkin,
    MAX(check_time) as latest_checkin
FROM attendance_records
GROUP BY check_date
ORDER BY check_date DESC;

-- 创建视图：员工考勤统计
CREATE OR REPLACE VIEW employee_attendance_stats AS
SELECT
    u.id,
    u.name,
    u.department,
    COUNT(ar.id) as total_checkins,
    COUNT(DISTINCT ar.check_date) as days_checked,
    MAX(ar.check_date) as last_checkin_date,
    (SELECT COUNT(*) FROM attendance_records ar2 WHERE ar2.user_id = u.id AND ar2.check_date = CURDATE()) as checked_today
FROM users u
LEFT JOIN attendance_records ar ON u.id = ar.user_id
WHERE u.role = 'employee'
GROUP BY u.id, u.name, u.department
ORDER BY u.name;