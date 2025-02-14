<?php
session_start();
require_once('../config/database.php');

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    
    // 실제 데이터베이스에서 사용자 검증
    $stmt = $conn->prepare("SELECT id, password_hash FROM admin_users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        if (password_verify($password, $row['password_hash'])) {
            $_SESSION['admin_id'] = $row['id'];
            $_SESSION['admin_logged_in'] = true;
            echo json_encode(['success' => true]);
            exit;
        }
    }
    
    echo json_encode(['error' => '잘못된 로그인 정보입니다.']);
}
?>