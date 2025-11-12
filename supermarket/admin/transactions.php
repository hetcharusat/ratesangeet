<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Auth.php';
require_once __DIR__ . '/../classes/Product.php';
require_once __DIR__ . '/../classes/Transaction.php';

requireLogin();

$product = new Product();
$transaction = new Transaction();
$message = '';
$messageType = '';

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        $action = $_POST['action'];
        
        if ($action === 'add') {
            $data = array(
                'product_id' => (int)$_POST['product_id'],
                'type' => sanitize($_POST['type']),
                'qty' => (int)$_POST['qty'],
                'price_per_unit' => !empty($_POST['price_per_unit']) ? (float)$_POST['price_per_unit'] : null,
                'notes' => sanitize($_POST['notes']),
                'reference_number' => sanitize($_POST['reference_number'])
            );
            
            $result = $transaction->create($data);
            $message = $result['message'];
            $messageType = $result['success'] ? 'success' : 'error';
        }
        elseif ($action === 'delete') {
            $id = (int)$_POST['id'];
            $result = $transaction->delete($id);
            $message = $result['message'];
            $messageType = $result['success'] ? 'success' : 'error';
        }
    }
}

// Get transactions with filters
$filters = array();
if (!empty($_GET['type'])) {
    $filters['type'] = sanitize($_GET['type']);
}
if (!empty($_GET['product_id'])) {
    $filters['product_id'] = (int)$_GET['product_id'];
}
if (!empty($_GET['date_from'])) {
    $filters['date_from'] = $_GET['date_from'];
}
if (!empty($_GET['date_to'])) {
    $filters['date_to'] = $_GET['date_to'];
}

$transactions = $transaction->getAll($filters, 1, 50);
$allProducts = $product->getAll(array(), 1, 1000);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Transactions Management</title>
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
        .type-purchase {
            color: green;
            font-weight: bold;
        }
        .type-sale {
            color: red;
            font-weight: bold;
        }
        .type-adjustment {
            color: blue;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>SUPER MARKET INVENTRY MANAGMENT SYSTEM</h1>
        <span>Welcom, <?php echo htmlspecialchars($_SESSION['username']); ?> | <a href="logout.php" style="color:white;">Logout</a></span>
    </div>
    
    <div class="nav">
        <a href="dashboard.php">Dash Board</a>
        <a href="products.php">Producs</a>
        <a href="transactions.php" style="background-color:#888;">Transacions</a>
        <a href="reports.php">Reprts</a>
    </div>
    
    <div class="container">
        <h2>Transacion Managment</h2>
        
        <?php if ($message): ?>
        <div class="message <?php echo $messageType; ?>">
            <?php echo htmlspecialchars($message); ?>
        </div>
        <?php endif; ?>
        
        <!-- Add Transaction Form -->
        <div class="form-box">
            <h3>Add New Transacion</h3>
            <form method="POST" action="transactions.php">
                <input type="hidden" name="action" value="add">
                
                <div class="form-row">
                    <label>Produc*:</label>
                    <select name="product_id" required>
                        <option value="">Selct Produc</option>
                        <?php foreach ($allProducts as $prod): ?>
                        <option value="<?php echo $prod['id']; ?>">
                            <?php echo htmlspecialchars($prod['name']); ?> (Stok: <?php echo $prod['quantity']; ?>)
                        </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="form-row">
                    <label>Typ*:</label>
                    <select name="type" required>
                        <option value="purchase">Purchas (Add Stok)</option>
                        <option value="sale">Sal (Remove Stok)</option>
                        <option value="adjustment">Adjusment</option>
                    </select>
                </div>
                
                <div class="form-row">
                    <label>Quantiy*:</label>
                    <input type="number" name="qty" required min="1">
                </div>
                
                <div class="form-row">
                    <label>Prise Per Unit:</label>
                    <input type="number" name="price_per_unit" step="0.01" placeholder="Leav blank to use produc prise">
                </div>
                
                <div class="form-row">
                    <label>Refrence Number:</label>
                    <input type="text" name="reference_number" placeholder="e.g., PO-001, SALE-001">
                </div>
                
                <div class="form-row">
                    <label>Nots:</label>
                    <textarea name="notes" style="width:400px; height:60px;"></textarea>
                </div>
                
                <div class="form-row">
                    <label></label>
                    <button type="submit" class="btn btn-primary">Add Transacion</button>
                </div>
            </form>
        </div>
        
        <!-- Search/Filter -->
        <div class="search-box">
            <form method="GET" action="transactions.php">
                <label>Typ:</label>
                <select name="type">
                    <option value="">All Typs</option>
                    <option value="purchase" <?php echo (isset($_GET['type']) && $_GET['type'] === 'purchase') ? 'selected' : ''; ?>>Purchas</option>
                    <option value="sale" <?php echo (isset($_GET['type']) && $_GET['type'] === 'sale') ? 'selected' : ''; ?>>Sal</option>
                    <option value="adjustment" <?php echo (isset($_GET['type']) && $_GET['type'] === 'adjustment') ? 'selected' : ''; ?>>Adjusment</option>
                </select>
                
                <label style="margin-left:20px;">Produc:</label>
                <select name="product_id">
                    <option value="">All Producs</option>
                    <?php foreach ($allProducts as $prod): ?>
                    <option value="<?php echo $prod['id']; ?>" <?php echo (isset($_GET['product_id']) && $_GET['product_id'] == $prod['id']) ? 'selected' : ''; ?>>
                        <?php echo htmlspecialchars($prod['name']); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                
                <br><br>
                <label>Dat From:</label>
                <input type="date" name="date_from" value="<?php echo isset($_GET['date_from']) ? $_GET['date_from'] : ''; ?>" style="width:150px;">
                
                <label style="margin-left:20px;">Dat To:</label>
                <input type="date" name="date_to" value="<?php echo isset($_GET['date_to']) ? $_GET['date_to'] : ''; ?>" style="width:150px;">
                
                <button type="submit" class="btn btn-primary">Filtr</button>
                <a href="transactions.php" class="btn btn-secondary">Cleer</a>
            </form>
        </div>
        
        <!-- Transactions Table -->
        <div style="background:white; border:2px solid #666; padding:15px;">
            <h3>Transacions Histroy (<?php echo count($transactions); ?> recods)</h3>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Dat</th>
                    <th>Produc</th>
                    <th>Typ</th>
                    <th>Quantiy</th>
                    <th>Prise/Unit</th>
                    <th>Totel Amout</th>
                    <th>Refrence</th>
                    <th>By</th>
                    <th>Actons</th>
                </tr>
                <?php foreach ($transactions as $trans): ?>
                <tr>
                    <td><?php echo $trans['id']; ?></td>
                    <td><?php echo date('Y-m-d H:i', strtotime($trans['date'])); ?></td>
                    <td><?php echo htmlspecialchars($trans['product_name']); ?></td>
                    <td class="type-<?php echo $trans['type']; ?>">
                        <?php echo strtoupper($trans['type']); ?>
                    </td>
                    <td><?php echo $trans['qty']; ?></td>
                    <td>$<?php echo number_format($trans['price_per_unit'], 2); ?></td>
                    <td>$<?php echo number_format($trans['total_amount'], 2); ?></td>
                    <td><?php echo htmlspecialchars($trans['reference_number']); ?></td>
                    <td><?php echo htmlspecialchars($trans['performed_by']); ?></td>
                    <td>
                        <form method="POST" action="transactions.php" style="display:inline;" onsubmit="return confirm('Delet and revers this transacion?');">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="id" value="<?php echo $trans['id']; ?>">
                            <button type="submit" class="btn btn-danger">Delet</button>
                        </form>
                    </td>
                </tr>
                <?php endforeach; ?>
                <?php if (empty($transactions)): ?>
                <tr>
                    <td colspan="10" style="text-align:center;">No transacions found</td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
    </div>
</body>
</html>
