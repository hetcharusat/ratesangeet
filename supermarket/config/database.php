<?php
/**
 * Database Configuration and Connection Class
 * Uses PDO for secure database operations with prepared statements
 */

class Database {
    private $host = "localhost";
    private $db_name = "supermarket_inventory";
    private $username = "root";
    private $password = "";
    private $conn;
    
    /**
     * Get database connection
     * @return PDO|null Database connection or null on failure
     */
    public function getConnection() {
        $this->conn = null;
        
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password,
                array(
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                )
            );
            $this->conn->exec("set names utf8mb4");
        } catch(PDOException $exception) {
            error_log("Connection error: " . $exception->getMessage());
            return null;
        }
        
        return $this->conn;
    }
    
    /**
     * Close database connection
     */
    public function closeConnection() {
        $this->conn = null;
    }
    
    /**
     * Test database connection
     * @return bool True if connection successful
     */
    public function testConnection() {
        $conn = $this->getConnection();
        if ($conn !== null) {
            $this->closeConnection();
            return true;
        }
        return false;
    }
}
?>
