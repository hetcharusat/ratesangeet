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
        <h1>SUPER MARKET INVENTRY MANAGMENT SYSTEM</h1>
        <span>Welcom, <?php echo htmlspecialchars($_SESSION['username']); ?> | <a href="logout.php" style="color:white;">Logout</a></span>
    </div>
    
    <div class="nav">
        <a href="dashboard.php">Dash Board</a>
        <a href="products.php">Producs</a>
        <a href="transactions.php">Transacions</a>
        <a href="reports.php" style="background-color:#888;">Reprts</a>
    </div>
    
    <div class="container">
        <h2>Inventry Reprts</h2>
        
        <button onclick="window.print()" class="btn">Print Reprt</button>
        <br><br>
        
        <!-- Overall Statistics -->
        <div class="stats">
            <div class="stat-box">
                <h3>Totel Producs</h3>
                <div class="number"><?php echo $totalProducts; ?></div>
            </div>
            <div class="stat-box">
                <h3>Totel Stok Itmes</h3>
                <div class="number"><?php echo $totalStock; ?></div>
            </div>
            <div class="stat-box">
                <h3>Totel Inventry Valu</h3>
                <div class="number">$<?php echo number_format($totalValue, 2); ?></div>
            </div>
        </div>
        
        <!-- Category Breakdown -->
        <div class="section">
            <h3>Catagory-wise Brakdown</h3>
            <table>
                <tr>
                    <th>Catagory</th>
                    <th>Producs</th>
                    <th>Totel Stok</th>
                    <th>Totel Valu</th>
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
            <h3>Transacion Summery</h3>
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
        
        <!-- Low Stock Alert -->
        <div class="section">
            <h3>Low Stok Alart (<?php echo count($lowStockProducts); ?> itmes)</h3>
            <table>
                <tr>
                    <th>Produc</th>
                    <th>Catagory</th>
                    <th>Curent Stok</th>
                    <th>Threshhold</th>
                    <th>Need to Ordr</th>
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
                    <td colspan="5" style="text-align:center;">No low stok itmes</td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
        
        <!-- Expiring Products -->
        <div class="section">
            <h3>Producs Expireing Soon (<?php echo count($expiringProducts); ?> itmes)</h3>
            <table>
                <tr>
                    <th>Produc</th>
                    <th>Catagory</th>
                    <th>Stok</th>
                    <th>Expiry Dat</th>
                    <th>Days Remainig</th>
                    <th>Staus</th>
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
            <h3>Top 10 Producs by Inventry Valu</h3>
            <table>
                <tr>
                    <th>Produc</th>
                    <th>Catagory</th>
                    <th>Stok</th>
                    <th>Prise</th>
                    <th>Totel Valu</th>
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
            <p>Reprt Genrated: <?php echo date('Y-m-d H:i:s'); ?></p>
            <p>Genrated by: <?php echo htmlspecialchars($_SESSION['username']); ?></p>
        </div>
    </div>
</body>
</html>
