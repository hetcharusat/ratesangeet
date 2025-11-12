<?php
/**
 * Authentication Class
 * Handles user login, logout, and session management
 */

require_once __DIR__ . '/../config/config.php';

class Auth {
    private $db;
    private $conn;
    
    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }
    
    /**
     * Login user
     * @param string $username Username
     * @param string $password Password
     * @return array Result array with success status and message
     */
    public function login($username, $password) {
        try {
            $query = "SELECT id, username, password, full_name, email, is_active 
                     FROM admin_users 
                     WHERE username = :username LIMIT 1";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Check if user is active
                if (!$user['is_active']) {
                    return array('success' => false, 'message' => 'Account is disabled.');
                }
                
                // Verify password
                if (password_verify($password, $user['password'])) {
                    // Set session variables
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['full_name'] = $user['full_name'];
                    $_SESSION['email'] = $user['email'];
                    $_SESSION['login_time'] = time();
                    
                    // Update last login
                    $this->updateLastLogin($user['id']);
                    
                    // Log activity
                    $this->logActivity($user['id'], 'login', null, null, 'User logged in');
                    
                    return array('success' => true, 'message' => 'Login successful.');
                } else {
                    return array('success' => false, 'message' => 'Invalid password.');
                }
            } else {
                return array('success' => false, 'message' => 'User not found.');
            }
        } catch(PDOException $e) {
            error_log("Login error: " . $e->getMessage());
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Logout user
     */
    public function logout() {
        if (isset($_SESSION['user_id'])) {
            $this->logActivity($_SESSION['user_id'], 'logout', null, null, 'User logged out');
        }
        
        // Clear all session variables
        $_SESSION = array();
        
        // Delete session cookie
        if (isset($_COOKIE[session_name()])) {
            setcookie(session_name(), '', time() - 3600, '/');
        }
        
        // Destroy session
        session_destroy();
    }
    
    /**
     * Check if session is valid
     * @return bool True if valid
     */
    public function isSessionValid() {
        if (!isLoggedIn()) {
            return false;
        }
        
        // Check session timeout
        if (isset($_SESSION['login_time'])) {
            $elapsed = time() - $_SESSION['login_time'];
            if ($elapsed > SESSION_TIMEOUT) {
                $this->logout();
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Update last login timestamp
     * @param int $userId User ID
     */
    private function updateLastLogin($userId) {
        try {
            $query = "UPDATE admin_users SET last_login = NOW() WHERE id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
        } catch(PDOException $e) {
            error_log("Update last login error: " . $e->getMessage());
        }
    }
    
    /**
     * Log user activity
     * @param int $userId User ID
     * @param string $action Action performed
     * @param string $tableName Table name
     * @param int $recordId Record ID
     * @param string $description Description
     */
    public function logActivity($userId, $action, $tableName, $recordId, $description) {
        try {
            $query = "INSERT INTO activity_log 
                     (user_id, action, table_name, record_id, description, ip_address) 
                     VALUES (:user_id, :action, :table_name, :record_id, :description, :ip_address)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->bindParam(':action', $action);
            $stmt->bindParam(':table_name', $tableName);
            $stmt->bindParam(':record_id', $recordId);
            $stmt->bindParam(':description', $description);
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $stmt->bindParam(':ip_address', $ipAddress);
            $stmt->execute();
        } catch(PDOException $e) {
            error_log("Log activity error: " . $e->getMessage());
        }
    }
    
    /**
     * Register new user
     * @param array $data User data
     * @return array Result array with success status and message
     */
    public function register($data) {
        try {
            // Check if username already exists
            $query = "SELECT id FROM admin_users WHERE username = :username OR email = :email";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':username', $data['username']);
            $stmt->bindParam(':email', $data['email']);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                return array('success' => false, 'message' => 'Username or email already exists.');
            }
            
            // Hash password
            $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);
            
            // Insert new user
            $query = "INSERT INTO admin_users (username, password, email, full_name) 
                     VALUES (:username, :password, :email, :full_name)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':username', $data['username']);
            $stmt->bindParam(':password', $hashedPassword);
            $stmt->bindParam(':email', $data['email']);
            $stmt->bindParam(':full_name', $data['full_name']);
            
            if ($stmt->execute()) {
                return array('success' => true, 'message' => 'User registered successfully.');
            } else {
                return array('success' => false, 'message' => 'Failed to register user.');
            }
        } catch(PDOException $e) {
            error_log("Register error: " . $e->getMessage());
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
}
?>
