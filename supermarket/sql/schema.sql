-- Supermarket Inventory Management Database Schema
-- Database: supermarket_inventory

CREATE DATABASE IF NOT EXISTS supermarket_inventory;
USE supermarket_inventory;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    expiry_date DATE NULL,
    description TEXT,
    sku VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    low_stock_threshold INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_category (category),
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_quantity (quantity),
    INDEX idx_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    type ENUM('purchase', 'sale', 'adjustment') NOT NULL,
    qty INT NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    price_per_unit DECIMAL(10, 2),
    total_amount DECIMAL(10, 2),
    notes TEXT,
    performed_by VARCHAR(50),
    reference_number VARCHAR(100),
    INDEX idx_product_id (product_id),
    INDEX idx_type (type),
    INDEX idx_date (date),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity log table for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user (username: admin, password: admin123)
-- Password is hashed using bcrypt
INSERT INTO admin_users (username, password, email, full_name) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@supermarket.com', 'System Administrator')
ON DUPLICATE KEY UPDATE username=username;

-- Insert sample categories and products
INSERT INTO products (name, category, quantity, price, expiry_date, description, sku, low_stock_threshold) VALUES
('Milk 1L', 'Dairy', 50, 3.99, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Fresh whole milk', 'MILK-001', 20),
('Bread White', 'Bakery', 30, 2.49, DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Freshly baked white bread', 'BREAD-001', 15),
('Eggs 12-Pack', 'Dairy', 40, 4.99, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Farm fresh eggs', 'EGG-001', 10),
('Apples Red 1kg', 'Fruits', 5, 5.99, DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'Fresh red apples', 'APPLE-001', 10),
('Rice 5kg', 'Grains', 25, 12.99, DATE_ADD(CURDATE(), INTERVAL 365 DAY), 'Premium white rice', 'RICE-001', 5),
('Chicken Breast 1kg', 'Meat', 8, 9.99, DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Fresh chicken breast', 'CHICK-001', 10),
('Tomatoes 1kg', 'Vegetables', 3, 3.99, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Fresh tomatoes', 'TOM-001', 10),
('Pasta 500g', 'Grains', 60, 2.99, DATE_ADD(CURDATE(), INTERVAL 180 DAY), 'Italian pasta', 'PASTA-001', 20),
('Orange Juice 1L', 'Beverages', 2, 4.99, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'Fresh orange juice', 'OJ-001', 15),
('Yogurt 500g', 'Dairy', 7, 3.49, DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'Greek yogurt', 'YOG-001', 10)
ON DUPLICATE KEY UPDATE sku=sku;

-- Insert sample transactions
INSERT INTO transactions (product_id, type, qty, price_per_unit, total_amount, notes, performed_by, reference_number) VALUES
(1, 'purchase', 100, 3.50, 350.00, 'Initial stock purchase', 'admin', 'PO-001'),
(2, 'purchase', 50, 2.00, 100.00, 'Initial stock purchase', 'admin', 'PO-002'),
(3, 'purchase', 60, 4.50, 270.00, 'Initial stock purchase', 'admin', 'PO-003'),
(1, 'sale', 50, 3.99, 199.50, 'Daily sales', 'admin', 'SALE-001'),
(2, 'sale', 20, 2.49, 49.80, 'Daily sales', 'admin', 'SALE-002')
ON DUPLICATE KEY UPDATE id=id;
