<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Auth.php';
require_once __DIR__ . '/../classes/Product.php';
require_once __DIR__ . '/../classes/Transaction.php';

requireLogin();

$product = new Product();
$transaction = new Transaction();

// Get report data
$allProducts = $product->getAll(array(), 1, 1000);
$lowStockProducts = $product->getLowStock();
$expiringProducts = $product->getExpiring();

// Calculate totals
$totalProducts = count($allProducts);
$totalStock = array_sum(array_column($allProducts, 'quantity'));
$totalValue = 0;
foreach ($allProducts as $prod) {
    $totalValue += $prod['quantity'] * $prod['price'];
}

// Get transaction summary
$transactionSummary = $transaction->getSummary();

// Category-wise breakdown
$categoryData = array();
foreach ($allProducts as $prod) {
    $cat = $prod['category'];
    if (!isset($categoryData[$cat])) {
        $categoryData[$cat] = array('count' => 0, 'stock' => 0, 'value' => 0);
    }
    $categoryData[$cat]['count']++;
    $categoryData[$cat]['stock'] += $prod['quantity'];
    $categoryData[$cat]['value'] += $prod['quantity'] * $prod['price'];
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Reports</title>
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
        .section {
            background: white;
            border: 2px solid #666;
            padding: 15px;
            margin-bottom: 20px;
        }
        .section h3 {
            margin: 0 0 15px 0;
        }
        table {
            width: 100%;
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
        .btn {
            padding: 8px 15px;
            border: none;
            cursor: pointer;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            display: inline-block;
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
        <a href="products.php">Products</a>
        <a href="transactions.php">Transactions</a>
        <a href="reports.php" style="background-color:#888;">Reports</a>
    </div>
    
    <div class="container">
        <h2>Inventory Reports</h2>
        
        <button onclick="window.print()" class="btn">Print Report</button>
        <br><br>
        
        <!-- Overall Statistics -->
        <div class="stats">
            <div class="stat-box">
                <h3>Total Products</h3>
                <div class="number"><?php echo $totalProducts; ?></div>
            </div>
            <div class="stat-box">
                <h3>Total Stock Items</h3>
                <div class="number"><?php echo $totalStock; ?></div>
            </div>
            <div class="stat-box">
                <h3>Total Inventory Value</h3>
                <div class="number">$<?php echo number_format($totalValue, 2); ?></div>
            </div>
        </div>
        
        <!-- Category Breakdown -->
        <div class="section">
            <h3>Category-wise Breakdown</h3>
            <table>
                <tr>
                    <th>Category</th>
                    <th>Products</th>
                    <th>Total Stock</th>
                    <th>Total Value</th>
                </tr>
                <?php foreach ($categoryData as $cat => $data): ?>
                <tr>
                    <td><?php echo htmlspecialchars($cat); ?></td>
                    <td><?php echo $data['count']; ?></td>
                    <td><?php echo $data['stock']; ?></td>
                    <td>$<?php echo number_format($data['value'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        
        <!-- Transaction Summary -->
        <div class="section">
            <h3>Transaction Summary</h3>
            <table>
                <tr>
                    <th>Type</th>
                    <th>Count</th>
                    <th>Total Quantity</th>
                    <th>Total Amount</th>
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
        
        <!-- Low Stock Alert -->
        <div class="section">
            <h3>Low Stock Alert (<?php echo count($lowStockProducts); ?> items)</h3>
            <table>
                <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Threshold</th>
                    <th>Need to Order</th>
                </tr>
                <?php foreach ($lowStockProducts as $prod): ?>
                <tr>
                    <td><?php echo htmlspecialchars($prod['name']); ?></td>
                    <td><?php echo htmlspecialchars($prod['category']); ?></td>
                    <td style="color:red; font-weight:bold;"><?php echo $prod['quantity']; ?></td>
                    <td><?php echo $prod['low_stock_threshold']; ?></td>
                    <td><?php echo max(0, $prod['low_stock_threshold'] - $prod['quantity']); ?></td>
                </tr>
                <?php endforeach; ?>
                <?php if (empty($lowStockProducts)): ?>
                <tr>
                    <td colspan="5" style="text-align:center;">No low stock items</td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
        
        <!-- Expiring Products -->
        <div class="section">
            <h3>Products Expiring Soon (<?php echo count($expiringProducts); ?> items)</h3>
            <table>
                <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Expiry Date</th>
                    <th>Days Remaining</th>
                    <th>Status</th>
                </tr>
                <?php foreach ($expiringProducts as $prod): ?>
                <?php 
                    $daysLeft = floor((strtotime($prod['expiry_date']) - time()) / 86400);
                    $status = $daysLeft <= 2 ? 'URGENT' : 'WARNING';
                    $color = $daysLeft <= 2 ? 'red' : 'orange';
                ?>
                <tr>
                    <td><?php echo htmlspecialchars($prod['name']); ?></td>
                    <td><?php echo htmlspecialchars($prod['category']); ?></td>
                    <td><?php echo $prod['quantity']; ?></td>
                    <td><?php echo $prod['expiry_date']; ?></td>
                    <td style="color:<?php echo $color; ?>; font-weight:bold;"><?php echo $daysLeft; ?> days</td>
                    <td style="color:<?php echo $color; ?>; font-weight:bold;"><?php echo $status; ?></td>
                </tr>
                <?php endforeach; ?>
                <?php if (empty($expiringProducts)): ?>
                <tr>
                    <td colspan="6" style="text-align:center;">No expiring products</td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
        
        <!-- Top Products by Value -->
        <div class="section">
            <h3>Top 10 Products by Inventory Value</h3>
            <table>
                <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Total Value</th>
                </tr>
                <?php 
                // Sort products by value
                usort($allProducts, function($a, $b) {
                    $valueA = $a['quantity'] * $a['price'];
                    $valueB = $b['quantity'] * $b['price'];
                    return $valueB - $valueA;
                });
                
                $topProducts = array_slice($allProducts, 0, 10);
                foreach ($topProducts as $prod): 
                    $value = $prod['quantity'] * $prod['price'];
                ?>
                <tr>
                    <td><?php echo htmlspecialchars($prod['name']); ?></td>
                    <td><?php echo htmlspecialchars($prod['category']); ?></td>
                    <td><?php echo $prod['quantity']; ?></td>
                    <td>$<?php echo number_format($prod['price'], 2); ?></td>
                    <td><strong>$<?php echo number_format($value, 2); ?></strong></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        
        <div style="text-align:center; margin-top:30px; color:#666;">
            <p>Report Generated: <?php echo date('Y-m-d H:i:s'); ?></p>
            <p>Generated by: <?php echo htmlspecialchars($_SESSION['username']); ?></p>
        </div>
    </div>
</body>
</html>
