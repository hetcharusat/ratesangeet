<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Auth.php';
require_once __DIR__ . '/../classes/Product.php';

requireLogin();

$product = new Product();
$message = '';
$messageType = '';

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        $action = $_POST['action'];
        
        if ($action === 'add') {
            $data = array(
                'name' => sanitize($_POST['name']),
                'category' => sanitize($_POST['category']),
                'quantity' => (int)$_POST['quantity'],
                'price' => (float)$_POST['price'],
                'expiry_date' => !empty($_POST['expiry_date']) ? $_POST['expiry_date'] : null,
                'description' => sanitize($_POST['description']),
                'sku' => sanitize($_POST['sku']),
                'low_stock_threshold' => (int)$_POST['low_stock_threshold']
            );
            
            $result = $product->create($data);
            $message = $result['message'];
            $messageType = $result['success'] ? 'success' : 'error';
        }
        elseif ($action === 'edit') {
            $id = (int)$_POST['id'];
            $data = array(
                'name' => sanitize($_POST['name']),
                'category' => sanitize($_POST['category']),
                'quantity' => (int)$_POST['quantity'],
                'price' => (float)$_POST['price'],
                'expiry_date' => !empty($_POST['expiry_date']) ? $_POST['expiry_date'] : null,
                'description' => sanitize($_POST['description']),
                'sku' => sanitize($_POST['sku']),
                'low_stock_threshold' => (int)$_POST['low_stock_threshold']
            );
            
            $result = $product->update($id, $data);
            $message = $result['message'];
            $messageType = $result['success'] ? 'success' : 'error';
        }
        elseif ($action === 'delete') {
            $id = (int)$_POST['id'];
            $result = $product->delete($id);
            $message = $result['message'];
            $messageType = $result['success'] ? 'success' : 'error';
        }
    }
}

// Get products with filters
$filters = array();
if (!empty($_GET['search'])) {
    $filters['search'] = sanitize($_GET['search']);
}
if (!empty($_GET['category'])) {
    $filters['category'] = sanitize($_GET['category']);
}

$products = $product->getAll($filters, 1, 100);
$categories = $product->getCategories();

// Get product for editing
$editProduct = null;
if (isset($_GET['edit'])) {
    $editProduct = $product->getById((int)$_GET['edit']);
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Products Management</title>
    <style>
        body {
            font-family: Arial;
            margin: 0;
            background-color: #f0f0f0;
        }
        .header {
            background-color: #333;
            color: white;
            padding: 15px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .nav {
            background-color: #555;
            padding: 10px;
        }
        .nav a {
            color: white;
            text-decoration: none;
            padding: 8px 15px;
            margin-right: 5px;
            background-color: #666;
        }
        .nav a:hover {
            background-color: #777;
        }
        .container {
            padding: 20px;
        }
        .form-box {
            background: white;
            border: 2px solid #666;
            padding: 15px;
            margin-bottom: 20px;
        }
        .form-box h3 {
            margin: 0 0 15px 0;
        }
        .form-row {
            margin-bottom: 10px;
        }
        .form-row label {
            display: inline-block;
            width: 150px;
            font-weight: bold;
        }
        .form-row input, .form-row select, .form-row textarea {
            padding: 5px;
            width: 250px;
            border: 1px solid #666;
        }
        .form-row textarea {
            width: 400px;
            height: 60px;
        }
        .btn {
            padding: 8px 15px;
            border: none;
            cursor: pointer;
            margin-right: 5px;
        }
        .btn-primary {
            background-color: #4CAF50;
            color: white;
        }
        .btn-danger {
            background-color: #f44336;
            color: white;
        }
        .btn-secondary {
            background-color: #888;
            color: white;
        }
        .message {
            padding: 10px;
            margin-bottom: 15px;
            border: 2px solid;
        }
        .message.success {
            background-color: #d4edda;
            border-color: #28a745;
            color: #155724;
        }
        .message.error {
            background-color: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
        }
        table {
            width: 100%;
            background: white;
            border-collapse: collapse;
        }
        table th {
            background-color: #333;
            color: white;
            padding: 10px;
            text-align: left;
        }
        table td {
            padding: 8px;
            border: 1px solid #ddd;
        }
        table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .search-box {
            background: white;
            border: 2px solid #666;
            padding: 15px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SUPERMARKET INVENTORY MANAGEMENT SYSTEM</h1>
        <span>Welcome, <?php echo htmlspecialchars($_SESSION['username']); ?> | <a href="logout.php" style="color:white;">Logout</a></span>
    </div>
    
    <div class="nav">
        <a href="dashboard.php">Dashboard</a>
        <a href="products.php" style="background-color:#888;">Products</a>
        <a href="transactions.php">Transactions</a>
        <a href="reports.php">Reports</a>
    </div>
    
    <div class="container">
        <h2>Product Management</h2>
        
        <?php if ($message): ?>
        <div class="message <?php echo $messageType; ?>">
            <?php echo htmlspecialchars($message); ?>
        </div>
        <?php endif; ?>
        
        <!-- Add/Edit Form -->
        <div class="form-box">
            <h3><?php echo $editProduct ? 'Edit Product' : 'Add New Product'; ?></h3>
            <form method="POST" action="products.php">
                <input type="hidden" name="action" value="<?php echo $editProduct ? 'edit' : 'add'; ?>">
                <?php if ($editProduct): ?>
                <input type="hidden" name="id" value="<?php echo $editProduct['id']; ?>">
                <?php endif; ?>
                
                <div class="form-row">
                    <label>Product Name*:</label>
                    <input type="text" name="name" value="<?php echo $editProduct ? htmlspecialchars($editProduct['name']) : ''; ?>" required>
                </div>
                
                <div class="form-row">
                    <label>Category*:</label>
                    <input type="text" name="category" value="<?php echo $editProduct ? htmlspecialchars($editProduct['category']) : ''; ?>" required>
                </div>
                
                <div class="form-row">
                    <label>Quantity*:</label>
                    <input type="number" name="quantity" value="<?php echo $editProduct ? $editProduct['quantity'] : '0'; ?>" required min="0">
                </div>
                
                <div class="form-row">
                    <label>Price*:</label>
                    <input type="number" name="price" step="0.01" value="<?php echo $editProduct ? $editProduct['price'] : '0.00'; ?>" required min="0">
                </div>
                
                <div class="form-row">
                    <label>Expiry Date:</label>
                    <input type="date" name="expiry_date" value="<?php echo $editProduct ? $editProduct['expiry_date'] : ''; ?>">
                </div>
                
                <div class="form-row">
                    <label>SKU*:</label>
                    <input type="text" name="sku" value="<?php echo $editProduct ? htmlspecialchars($editProduct['sku']) : ''; ?>" required>
                </div>
                
                <div class="form-row">
                    <label>Low Stock Threshold*:</label>
                    <input type="number" name="low_stock_threshold" value="<?php echo $editProduct ? $editProduct['low_stock_threshold'] : '10'; ?>" required min="1">
                </div>
                
                <div class="form-row">
                    <label>Description:</label>
                    <textarea name="description"><?php echo $editProduct ? htmlspecialchars($editProduct['description']) : ''; ?></textarea>
                </div>
                
                <div class="form-row">
                    <label></label>
                    <button type="submit" class="btn btn-primary"><?php echo $editProduct ? 'Update Product' : 'Add Product'; ?></button>
                    <?php if ($editProduct): ?>
                    <a href="products.php" class="btn btn-secondary">Cancel</a>
                    <?php endif; ?>
                </div>
            </form>
        </div>
        
        <!-- Search/Filter -->
        <div class="search-box">
            <form method="GET" action="products.php">
                <label>Search:</label>
                <input type="text" name="search" value="<?php echo isset($_GET['search']) ? htmlspecialchars($_GET['search']) : ''; ?>" placeholder="Product name or SKU">
                
                <label style="margin-left:20px;">Category:</label>
                <select name="category">
                    <option value="">All Categories</option>
                    <?php foreach ($categories as $cat): ?>
                    <option value="<?php echo htmlspecialchars($cat); ?>" <?php echo (isset($_GET['category']) && $_GET['category'] === $cat) ? 'selected' : ''; ?>>
                        <?php echo htmlspecialchars($cat); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                
                <button type="submit" class="btn btn-primary">Search</button>
                <a href="products.php" class="btn btn-secondary">Clear</a>
            </form>
        </div>
        
        <!-- Products Table -->
        <div style="background:white; border:2px solid #666; padding:15px;">
            <h3>Products List (<?php echo count($products); ?> items)</h3>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Expiry Date</th>
                    <th>Actions</th>
                </tr>
                <?php foreach ($products as $prod): ?>
                <tr>
                    <td><?php echo $prod['id']; ?></td>
                    <td><?php echo htmlspecialchars($prod['name']); ?></td>
                    <td><?php echo htmlspecialchars($prod['category']); ?></td>
                    <td><?php echo htmlspecialchars($prod['sku']); ?></td>
                    <td <?php if ($prod['quantity'] <= $prod['low_stock_threshold']) echo 'style="color:red;font-weight:bold;"'; ?>>
                        <?php echo $prod['quantity']; ?>
                    </td>
                    <td>$<?php echo number_format($prod['price'], 2); ?></td>
                    <td><?php echo $prod['expiry_date'] ?? '-'; ?></td>
                    <td>
                        <a href="products.php?edit=<?php echo $prod['id']; ?>" class="btn btn-secondary">Edit</a>
                        <form method="POST" action="products.php" style="display:inline;" onsubmit="return confirm('Delete this product?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="id" value="<?php echo $prod['id']; ?>">
                            <button type="submit" class="btn btn-danger">Delete</button>
                        </form>
                    </td>
                </tr>
                <?php endforeach; ?>
                <?php if (empty($products)): ?>
                <tr>
                    <td colspan="8" style="text-align:center;">No products found</td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
    </div>
</body>
</html>
