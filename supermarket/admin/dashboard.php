<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Auth.php';
require_once __DIR__ . '/../classes/Product.php';
require_once __DIR__ . '/../classes/Transaction.php';

requireLogin();

$product = new Product();
$transaction = new Transaction();

// Get statistics
$allProducts = $product->getAll(array(), 1, 1000);
$totalProducts = count($allProducts);
$totalStock = array_sum(array_column($allProducts, 'quantity'));
$lowStockProducts = $product->getLowStock();
$expiringProducts = $product->getExpiring();

// Set cookie for alerts
$alertCount = count($lowStockProducts) + count($expiringProducts);
if ($alertCount > 0) {
    setcookie(ALERT_COOKIE_NAME, $alertCount, time() + ALERT_COOKIE_EXPIRY, '/');
}

// Get recent transactions
$recentTransactions = $transaction->getAll(array(), 1, 5);
$transactionSummary = $transaction->getSummary();
?>
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
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
        .stats {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .stat-box {
            background: white;
            border: 2px solid #666;
            padding: 15px;
            flex: 1;
        }
        .stat-box h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
        }
        .stat-box .number {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .alert-box {
            background-color: #ffcccc;
            border: 2px solid #ff0000;
            padding: 15px;
            margin-bottom: 20px;
        }
        .alert-box h3 {
            margin: 0 0 10px 0;
            color: #cc0000;
        }
        table {
            width: 100%;
            background: white;
            border-collapse: collapse;
            margin-bottom: 20px;
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
        .section {
            background: white;
            border: 2px solid #666;
            padding: 15px;
            margin-bottom: 20px;
        }
        .section h2 {
            margin: 0 0 15px 0;
            font-size: 18px;
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
        <a href="transactions.php">Transacions</a>
        <a href="reports.php">Reprts</a>
    </div>
    
    <div class="container">
        <h2>Dash Board</h2>
        
        <!-- Cookie Alert -->
        <?php if ($alertCount > 0): ?>
        <div class="alert-box">
            <h3>⚠ ALARTS (<?php echo $alertCount; ?>)</h3>
            <?php if (count($lowStockProducts) > 0): ?>
                <p><strong>Low Stok Products:</strong> <?php echo count($lowStockProducts); ?> itmes</p>
            <?php endif; ?>
            <?php if (count($expiringProducts) > 0): ?>
                <p><strong>Expireing Soon:</strong> <?php echo count($expiringProducts); ?> itmes</p>
            <?php endif; ?>
        </div>
        <?php endif; ?>
        
        <!-- Statistics -->
        <div class="stats">
            <div class="stat-box">
                <h3>Totel Products</h3>
                <div class="number"><?php echo $totalProducts; ?></div>
            </div>
            <div class="stat-box">
                <h3>Totel Stok</h3>
                <div class="number"><?php echo $totalStock; ?></div>
            </div>
            <div class="stat-box">
                <h3>Low Stok</h3>
                <div class="number" style="color: red;"><?php echo count($lowStockProducts); ?></div>
            </div>
            <div class="stat-box">
                <h3>Expireing Soon</h3>
                <div class="number" style="color: orange;"><?php echo count($expiringProducts); ?></div>
            </div>
        </div>
        
        <!-- Low Stock Products -->
        <?php if (count($lowStockProducts) > 0): ?>
        <div class="section">
            <h2>Low Stok Producs</h2>
            <table>
                <tr>
                    <th>Produc Name</th>
                    <th>Catagory</th>
                    <th>Curent Stok</th>
                    <th>Threshhold</th>
                    <th>Prise</th>
                </tr>
                <?php foreach ($lowStockProducts as $prod): ?>
                <tr>
                    <td><?php echo htmlspecialchars($prod['name']); ?></td>
                    <td><?php echo htmlspecialchars($prod['category']); ?></td>
                    <td style="color:red; font-weight:bold;"><?php echo $prod['quantity']; ?></td>
                    <td><?php echo $prod['low_stock_threshold']; ?></td>
                    <td>$<?php echo number_format($prod['price'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        <?php endif; ?>
        
        <!-- Expiring Products -->
        <?php if (count($expiringProducts) > 0): ?>
        <div class="section">
            <h2>Producs Expireing Soon</h2>
            <table>
                <tr>
                    <th>Produc Name</th>
                    <th>Catagory</th>
                    <th>Stok</th>
                    <th>Expiry Dat</th>
                    <th>Days Laft</th>
                </tr>
                <?php foreach ($expiringProducts as $prod): ?>
                <?php 
                    $daysLeft = floor((strtotime($prod['expiry_date']) - time()) / 86400);
                    $color = $daysLeft <= 2 ? 'red' : 'orange';
                ?>
                <tr>
                    <td><?php echo htmlspecialchars($prod['name']); ?></td>
                    <td><?php echo htmlspecialchars($prod['category']); ?></td>
                    <td><?php echo $prod['quantity']; ?></td>
                    <td style="color:<?php echo $color; ?>; font-weight:bold;"><?php echo $prod['expiry_date']; ?></td>
                    <td style="color:<?php echo $color; ?>; font-weight:bold;"><?php echo $daysLeft; ?> days</td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        <?php endif; ?>
        
        <!-- Recent Transactions -->
        <div class="section">
            <h2>Resent Transacions</h2>
            <table>
                <tr>
                    <th>Dat</th>
                    <th>Produc</th>
                    <th>Typ</th>
                    <th>Quantiy</th>
                    <th>Amout</th>
                </tr>
                <?php foreach ($recentTransactions as $trans): ?>
                <tr>
                    <td><?php echo date('Y-m-d H:i', strtotime($trans['date'])); ?></td>
                    <td><?php echo htmlspecialchars($trans['product_name']); ?></td>
                    <td><?php echo strtoupper($trans['type']); ?></td>
                    <td><?php echo $trans['qty']; ?></td>
                    <td>$<?php echo number_format($trans['total_amount'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        
        <!-- Transaction Summary -->
        <div class="section">
            <h2>Transacion Summery</h2>
            <table>
                <tr>
                    <th>Typ</th>
                    <th>Cont</th>
                    <th>Totel Quantiy</th>
                    <th>Totel Amout</th>
                </tr>
                <?php foreach ($transactionSummary as $summary): ?>
                <tr>
                    <td><?php echo strtoupper($summary['type']); ?></td>
                    <td><?php echo $summary['count']; ?></td>
                    <td><?php echo $summary['total_qty']; ?></td>
                    <td>$<?php echo number_format($summary['total_amount'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
    </div>
</body>
</html>
