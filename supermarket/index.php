<?php
/**
 * Login Page
 * Admin authentication interface
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/Auth.php';

// Redirect if already logged in
if (isLoggedIn()) {
    header('Location: admin/dashboard.php');
    exit();
}

// Handle login form submission
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = sanitize($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        $error = 'Please enter both username and password.';
    } else {
        $auth = new Auth();
        $result = $auth->login($username, $password);
        
        if ($result['success']) {
            header('Location: admin/dashboard.php');
            exit();
        } else {
            $error = $result['message'];
        }
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Login Page</title>
    <style>
        body {
            background-color: #e0e0e0;
            font-family: Arial;
        }
        .container {
            width: 350px;
            margin: 100px auto;
            background: white;
            padding: 20px;
            border: 2px solid #333;
        }
        h2 {
            text-align: center;
            color: #333;
        }
        table {
            width: 100%;
        }
        td {
            padding: 5px;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            padding: 5px;
            border: 1px solid #666;
        }
        input[type="submit"] {
            width: 100%;
            padding: 8px;
            background-color: #4CAF50;
            color: white;
            border: none;
            cursor: pointer;
            margin-top: 10px;
        }
        .error {
            color: red;
            font-size: 12px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Super Market Inventry System</h2>
        <h3 style="text-align:center">Admin Loging</h3>
        
        <?php if (!empty($error)): ?>
            <div class="error">
                Eror: <?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <table>
                <tr>
                    <td>User Name:</td>
                </tr>
                <tr>
                    <td><input type="text" name="username" required></td>
                </tr>
                <tr>
                    <td>Pass word:</td>
                </tr>
                <tr>
                    <td><input type="password" name="password" required></td>
                </tr>
                <tr>
                    <td>
                        <input type="submit" value="Login">
                    </td>
                </tr>
            </table>
        </form>
        <p style="font-size:11px; text-align:center; margin-top:15px;">
            Defualt: admin / admin123
        </p>
    </div>
</body>
</html>
