<?php
/**
 * Transaction Class
 * Handles all transaction-related operations (purchases, sales, adjustments)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/Product.php';

class Transaction {
    private $db;
    private $conn;
    private $product;
    
    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
        $this->product = new Product();
    }
    
    /**
     * Get all transactions with optional filtering and pagination
     * @param array $filters Filters (product_id, type, date_from, date_to)
     * @param int $page Page number
     * @param int $perPage Records per page
     * @return array Transactions array
     */
    public function getAll($filters = array(), $page = 1, $perPage = RECORDS_PER_PAGE) {
        try {
            $offset = ($page - 1) * $perPage;
            
            $query = "SELECT t.*, p.name as product_name, p.sku 
                     FROM transactions t
                     LEFT JOIN products p ON t.product_id = p.id
                     WHERE 1=1";
            $params = array();
            
            // Apply filters
            if (!empty($filters['product_id'])) {
                $query .= " AND t.product_id = :product_id";
                $params[':product_id'] = $filters['product_id'];
            }
            
            if (!empty($filters['type'])) {
                $query .= " AND t.type = :type";
                $params[':type'] = $filters['type'];
            }
            
            if (!empty($filters['date_from'])) {
                $query .= " AND DATE(t.date) >= :date_from";
                $params[':date_from'] = $filters['date_from'];
            }
            
            if (!empty($filters['date_to'])) {
                $query .= " AND DATE(t.date) <= :date_to";
                $params[':date_to'] = $filters['date_to'];
            }
            
            $query .= " ORDER BY t.date DESC LIMIT :limit OFFSET :offset";
            
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
            error_log("Get transactions error: " . $e->getMessage());
            return array();
        }
    }
    
    /**
     * Get total count of transactions
     * @param array $filters Filters
     * @return int Total count
     */
    public function getCount($filters = array()) {
        try {
            $query = "SELECT COUNT(*) as total FROM transactions WHERE 1=1";
            $params = array();
            
            if (!empty($filters['product_id'])) {
                $query .= " AND product_id = :product_id";
                $params[':product_id'] = $filters['product_id'];
            }
            
            if (!empty($filters['type'])) {
                $query .= " AND type = :type";
                $params[':type'] = $filters['type'];
            }
            
            if (!empty($filters['date_from'])) {
                $query .= " AND DATE(date) >= :date_from";
                $params[':date_from'] = $filters['date_from'];
            }
            
            if (!empty($filters['date_to'])) {
                $query .= " AND DATE(date) <= :date_to";
                $params[':date_to'] = $filters['date_to'];
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
     * Get transaction by ID
     * @param int $id Transaction ID
     * @return array|null Transaction data or null
     */
    public function getById($id) {
        try {
            $query = "SELECT t.*, p.name as product_name, p.sku 
                     FROM transactions t
                     LEFT JOIN products p ON t.product_id = p.id
                     WHERE t.id = :id LIMIT 1";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            error_log("Get transaction by ID error: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Create new transaction and update product stock
     * @param array $data Transaction data
     * @return array Result with success status and message
     */
    public function create($data) {
        try {
            // Start transaction
            $this->conn->beginTransaction();
            
            // Get product details
            $product = $this->product->getById($data['product_id']);
            if (!$product) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Product not found.');
            }
            
            // Calculate total amount
            $pricePerUnit = isset($data['price_per_unit']) ? $data['price_per_unit'] : $product['price'];
            $totalAmount = $pricePerUnit * $data['qty'];
            
            // Validate stock for sales
            if ($data['type'] === 'sale') {
                if ($product['quantity'] < $data['qty']) {
                    $this->conn->rollBack();
                    return array('success' => false, 'message' => 'Insufficient stock. Available: ' . $product['quantity']);
                }
            }
            
            // Insert transaction
            $query = "INSERT INTO transactions 
                     (product_id, type, qty, price_per_unit, total_amount, notes, performed_by, reference_number) 
                     VALUES (:product_id, :type, :qty, :price_per_unit, :total_amount, :notes, :performed_by, :reference_number)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':product_id', $data['product_id'], PDO::PARAM_INT);
            $stmt->bindParam(':type', $data['type']);
            $stmt->bindParam(':qty', $data['qty'], PDO::PARAM_INT);
            $stmt->bindParam(':price_per_unit', $pricePerUnit);
            $stmt->bindParam(':total_amount', $totalAmount);
            $notes = $data['notes'] ?? '';
            $stmt->bindParam(':notes', $notes);
            $performedBy = $_SESSION['username'] ?? 'system';
            $stmt->bindParam(':performed_by', $performedBy);
            $refNumber = $data['reference_number'] ?? '';
            $stmt->bindParam(':reference_number', $refNumber);
            
            if (!$stmt->execute()) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to create transaction.');
            }
            
            $transactionId = $this->conn->lastInsertId();
            
            // Update product stock
            $quantityChange = 0;
            switch ($data['type']) {
                case 'purchase':
                    $quantityChange = $data['qty'];
                    break;
                case 'sale':
                    $quantityChange = -$data['qty'];
                    break;
                case 'adjustment':
                    $quantityChange = $data['qty']; // Can be positive or negative
                    break;
            }
            
            if (!$this->product->updateStock($data['product_id'], $quantityChange)) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to update stock.');
            }
            
            // Commit transaction
            $this->conn->commit();
            
            // Log activity
            if (isset($_SESSION['user_id'])) {
                $auth = new Auth();
                $auth->logActivity($_SESSION['user_id'], 'create', 'transactions', $transactionId, 
                    "Created {$data['type']} transaction for {$product['name']} (Qty: {$data['qty']})");
            }
            
            return array('success' => true, 'message' => 'Transaction completed successfully.', 'id' => $transactionId);
            
        } catch(PDOException $e) {
            $this->conn->rollBack();
            error_log("Create transaction error: " . $e->getMessage());
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Update transaction
     * @param int $id Transaction ID
     * @param array $data Transaction data
     * @return array Result with success status and message
     */
    public function update($id, $data) {
        try {
            // Start transaction
            $this->conn->beginTransaction();
            
            // Get old transaction
            $oldTransaction = $this->getById($id);
            if (!$oldTransaction) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Transaction not found.');
            }
            
            // Reverse old stock change
            $oldQuantityChange = 0;
            switch ($oldTransaction['type']) {
                case 'purchase':
                    $oldQuantityChange = -$oldTransaction['qty'];
                    break;
                case 'sale':
                    $oldQuantityChange = $oldTransaction['qty'];
                    break;
                case 'adjustment':
                    $oldQuantityChange = -$oldTransaction['qty'];
                    break;
            }
            
            if (!$this->product->updateStock($oldTransaction['product_id'], $oldQuantityChange)) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to reverse old stock change.');
            }
            
            // Update transaction
            $product = $this->product->getById($data['product_id']);
            $pricePerUnit = isset($data['price_per_unit']) ? $data['price_per_unit'] : $product['price'];
            $totalAmount = $pricePerUnit * $data['qty'];
            
            $query = "UPDATE transactions SET 
                     product_id = :product_id, 
                     type = :type, 
                     qty = :qty, 
                     price_per_unit = :price_per_unit, 
                     total_amount = :total_amount, 
                     notes = :notes, 
                     reference_number = :reference_number 
                     WHERE id = :id";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':product_id', $data['product_id'], PDO::PARAM_INT);
            $stmt->bindParam(':type', $data['type']);
            $stmt->bindParam(':qty', $data['qty'], PDO::PARAM_INT);
            $stmt->bindParam(':price_per_unit', $pricePerUnit);
            $stmt->bindParam(':total_amount', $totalAmount);
            $notes = $data['notes'] ?? '';
            $stmt->bindParam(':notes', $notes);
            $refNumber = $data['reference_number'] ?? '';
            $stmt->bindParam(':reference_number', $refNumber);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            
            if (!$stmt->execute()) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to update transaction.');
            }
            
            // Apply new stock change
            $newQuantityChange = 0;
            switch ($data['type']) {
                case 'purchase':
                    $newQuantityChange = $data['qty'];
                    break;
                case 'sale':
                    $newQuantityChange = -$data['qty'];
                    break;
                case 'adjustment':
                    $newQuantityChange = $data['qty'];
                    break;
            }
            
            if (!$this->product->updateStock($data['product_id'], $newQuantityChange)) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to update stock.');
            }
            
            // Commit transaction
            $this->conn->commit();
            
            // Log activity
            if (isset($_SESSION['user_id'])) {
                $auth = new Auth();
                $auth->logActivity($_SESSION['user_id'], 'update', 'transactions', $id, 
                    "Updated transaction for {$product['name']}");
            }
            
            return array('success' => true, 'message' => 'Transaction updated successfully.');
            
        } catch(PDOException $e) {
            $this->conn->rollBack();
            error_log("Update transaction error: " . $e->getMessage());
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Delete transaction and reverse stock change
     * @param int $id Transaction ID
     * @return array Result with success status and message
     */
    public function delete($id) {
        try {
            // Start transaction
            $this->conn->beginTransaction();
            
            // Get transaction
            $transaction = $this->getById($id);
            if (!$transaction) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Transaction not found.');
            }
            
            // Reverse stock change
            $quantityChange = 0;
            switch ($transaction['type']) {
                case 'purchase':
                    $quantityChange = -$transaction['qty'];
                    break;
                case 'sale':
                    $quantityChange = $transaction['qty'];
                    break;
                case 'adjustment':
                    $quantityChange = -$transaction['qty'];
                    break;
            }
            
            if (!$this->product->updateStock($transaction['product_id'], $quantityChange)) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to reverse stock change.');
            }
            
            // Delete transaction
            $query = "DELETE FROM transactions WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            
            if (!$stmt->execute()) {
                $this->conn->rollBack();
                return array('success' => false, 'message' => 'Failed to delete transaction.');
            }
            
            // Commit transaction
            $this->conn->commit();
            
            // Log activity
            if (isset($_SESSION['user_id'])) {
                $auth = new Auth();
                $auth->logActivity($_SESSION['user_id'], 'delete', 'transactions', $id, 
                    "Deleted transaction for {$transaction['product_name']}");
            }
            
            return array('success' => true, 'message' => 'Transaction deleted successfully.');
            
        } catch(PDOException $e) {
            $this->conn->rollBack();
            error_log("Delete transaction error: " . $e->getMessage());
            return array('success' => false, 'message' => 'An error occurred. Please try again.');
        }
    }
    
    /**
     * Get transaction summary/statistics
     * @param array $filters Filters
     * @return array Summary data
     */
    public function getSummary($filters = array()) {
        try {
            $query = "SELECT 
                     type,
                     COUNT(*) as count,
                     SUM(qty) as total_qty,
                     SUM(total_amount) as total_amount
                     FROM transactions
                     WHERE 1=1";
            $params = array();
            
            if (!empty($filters['date_from'])) {
                $query .= " AND DATE(date) >= :date_from";
                $params[':date_from'] = $filters['date_from'];
            }
            
            if (!empty($filters['date_to'])) {
                $query .= " AND DATE(date) <= :date_to";
                $params[':date_to'] = $filters['date_to'];
            }
            
            $query .= " GROUP BY type";
            
            $stmt = $this->conn->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            error_log("Get summary error: " . $e->getMessage());
            return array();
        }
    }
}
?>
