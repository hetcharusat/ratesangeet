<?php
/**
 * Product Class
 * Handles all product-related operations (CRUD)
 */

require_once __DIR__ . '/../config/config.php';

class Product {
    private $db;
    private $conn;
    
    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }
    
    /**
     * Get all products with optional filtering and pagination
     * @param array $filters Filters (category, search, low_stock, expiring)
     * @param int $page Page number
     * @param int $perPage Records per page
     * @return array Products array
     */
    public function getAll($filters = array(), $page = 1, $perPage = RECORDS_PER_PAGE) {
        try {
            $offset = ($page - 1) * $perPage;
            
            $query = "SELECT * FROM products WHERE is_active = 1";
            $params = array();
            
            // Apply filters
            if (!empty($filters['category'])) {
                $query .= " AND category = :category";
                $params[':category'] = $filters['category'];
            }
            
            if (!empty($filters['search'])) {
                $query .= " AND (name LIKE :search OR sku LIKE :search OR description LIKE :search)";
                $params[':search'] = '%' . $filters['search'] . '%';
            }
            
            if (isset($filters['low_stock']) && $filters['low_stock']) {
                $query .= " AND quantity <= low_stock_threshold";
            }
            
            if (isset($filters['expiring']) && $filters['expiring']) {
                $query .= " AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL " . EXPIRY_WARNING_DAYS . " DAY)";
            }
            
            $query .= " ORDER BY name ASC LIMIT :limit OFFSET :offset";
            
            $stmt = $this->conn->prepare($query);
            
            // Bind parameters
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            error_log("Get products error: " . $e->getMessage());
            return array();
        }
    }
    
    /**
     * Get total count of products
     * @param array $filters Filters
     * @return int Total count
     */
    public function getCount($filters = array()) {
        try {
            $query = "SELECT COUNT(*) as total FROM products WHERE is_active = 1";
            $params = array();
            
            if (!empty($filters['category'])) {
                $query .= " AND category = :category";
                $params[':category'] = $filters['category'];
            }
            
            if (!empty($filters['search'])) {
                $query .= " AND (name LIKE :search OR sku LIKE :search)";
                $params[':search'] = '%' . $filters['search'] . '%';
            }
            
            if (isset($filters['low_stock']) && $filters['low_stock']) {
                $query .= " AND quantity <= low_stock_threshold";
            }
            
            if (isset($filters['expiring']) && $filters['expiring']) {
                $query .= " AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL " . EXPIRY_WARNING_DAYS . " DAY)";
            }
            
            $stmt = $this->conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return (int)$result['total'];
        } catch(PDOException $e) {
            error_log("Get count error: " . $e->getMessage());
            return 0;
        }
    }
    
    /**
     * Get product by ID
     * @param int $id Product ID
     * @return array|null Product data or null
     */
    public function getById($id) {
        try {
            $query = "SELECT * FROM products WHERE id = :id LIMIT 1";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            error_log("Get product by ID error: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Create new product
     * @param array $data Product data
     * @return array Result with success status and message
     */
    public function create($data) {
        try {
            $query = "INSERT INTO products 
                     (name, category, quantity, price, expiry_date, description, sku, low_stock_threshold) 
                     VALUES (:name, :category, :quantity, :price, :expiry_date, :description, :sku, :low_stock_threshold)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':category', $data['category']);
            $stmt->bindParam(':quantity', $data['quantity'], PDO::PARAM_INT);
            $stmt->bindParam(':price', $data['price']);
            $stmt->bindParam(':expiry_date', $data['expiry_date']);
            $stmt->bindParam(':description', $data['description']);
            $stmt->bindParam(':sku', $data['sku']);
            $threshold = $data['low_stock_threshold'] ?? LOW_STOCK_THRESHOLD;
            $stmt->bindParam(':low_stock_threshold', $threshold, PDO::PARAM_INT);
            
            if ($stmt->execute()) {
                $productId = $this->conn->lastInsertId();
                
                // Log activity
                if (isset($_SESSION['user_id'])) {
                    $auth = new Auth();
                    $auth->logActivity($_SESSION['user_id'], 'create', 'products', $productId, "Created product: {$data['name']}");
                }
                
                return array('success' => true, 'message' => 'Product created successfully.', 'id' => $productId);
            } else {
                return array('success' => false, 'message' => 'Failed to create product.');
            }
        } catch(PDOException $e) {
            error_log("Create product error: " . $e->getMessage());
            if ($e->getCode() == 23000) {
                return array('success' => false, 'message' => 'SKU already exists.');
            }
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Update product
     * @param int $id Product ID
     * @param array $data Product data
     * @return array Result with success status and message
     */
    public function update($id, $data) {
        try {
            $query = "UPDATE products SET 
                     name = :name, 
                     category = :category, 
                     quantity = :quantity, 
                     price = :price, 
                     expiry_date = :expiry_date, 
                     description = :description, 
                     sku = :sku, 
                     low_stock_threshold = :low_stock_threshold 
                     WHERE id = :id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':category', $data['category']);
            $stmt->bindParam(':quantity', $data['quantity'], PDO::PARAM_INT);
            $stmt->bindParam(':price', $data['price']);
            $stmt->bindParam(':expiry_date', $data['expiry_date']);
            $stmt->bindParam(':description', $data['description']);
            $stmt->bindParam(':sku', $data['sku']);
            $threshold = $data['low_stock_threshold'] ?? LOW_STOCK_THRESHOLD;
            $stmt->bindParam(':low_stock_threshold', $threshold, PDO::PARAM_INT);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            
            if ($stmt->execute()) {
                // Log activity
                if (isset($_SESSION['user_id'])) {
                    $auth = new Auth();
                    $auth->logActivity($_SESSION['user_id'], 'update', 'products', $id, "Updated product: {$data['name']}");
                }
                
                return array('success' => true, 'message' => 'Product updated successfully.');
            } else {
                return array('success' => false, 'message' => 'Failed to update product.');
            }
        } catch(PDOException $e) {
            error_log("Update product error: " . $e->getMessage());
            if ($e->getCode() == 23000) {
                return array('success' => false, 'message' => 'SKU already exists.');
            }
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Delete product (soft delete)
     * @param int $id Product ID
     * @return array Result with success status and message
     */
    public function delete($id) {
        try {
            $product = $this->getById($id);
            
            $query = "UPDATE products SET is_active = 0 WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            
            if ($stmt->execute()) {
                // Log activity
                if (isset($_SESSION['user_id'])) {
                    $auth = new Auth();
                    $auth->logActivity($_SESSION['user_id'], 'delete', 'products', $id, "Deleted product: {$product['name']}");
                }
                
                return array('success' => true, 'message' => 'Product deleted successfully.');
            } else {
                return array('success' => false, 'message' => 'Failed to delete product.');
            }
        } catch(PDOException $e) {
            error_log("Delete product error: " . $e->getMessage());
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Get all unique categories
     * @return array Categories array
     */
    public function getCategories() {
        try {
            $query = "SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category ASC";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            
            $categories = array();
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $categories[] = $row['category'];
            }
            return $categories;
        } catch(PDOException $e) {
            error_log("Get categories error: " . $e->getMessage());
            return array();
        }
    }
    
    /**
     * Update stock quantity
     * @param int $productId Product ID
     * @param int $quantity Quantity change (positive or negative)
     * @return bool Success status
     */
    public function updateStock($productId, $quantity) {
        try {
            $query = "UPDATE products SET quantity = quantity + :quantity WHERE id = :product_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':quantity', $quantity, PDO::PARAM_INT);
            $stmt->bindParam(':product_id', $productId, PDO::PARAM_INT);
            
            return $stmt->execute();
        } catch(PDOException $e) {
            error_log("Update stock error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get low stock products
     * @return array Products array
     */
    public function getLowStock() {
        return $this->getAll(array('low_stock' => true), 1, 100);
    }
    
    /**
     * Get expiring products
     * @return array Products array
     */
    public function getExpiring() {
        return $this->getAll(array('expiring' => true), 1, 100);
    }
}
?>
