<?php
require_once('headers.php');
setSecureHeaders();

session_start();

// 인증 확인
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// CSRF 보호
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token']);
        exit;
    }
}

// 데이터베이스 설정 로드
$config = require_once('../config/database.php');
$conn = new mysqli($config['host'], $config['username'], $config['password'], $config['dbname']);

// XSS 방지 함수
function sanitize_output($data) {
    return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
}

// 파일 업로드 보안
function secure_file_upload($file) {
    $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $max_size = 5 * 1024 * 1024; // 5MB
    
    if (!in_array($file['type'], $allowed_types)) {
        throw new Exception('허용되지 않는 파일 형식입니다.');
    }
    
    if ($file['size'] > $max_size) {
        throw new Exception('파일 크기가 너무 큽니다.');
    }
    
    $file_name = uniqid() . '_' . basename($file['name']);
    $target_path = '../uploads/' . $file_name;
    
    if (!move_uploaded_file($file['tmp_name'], $target_path)) {
        throw new Exception('파일 업로드 실패');
    }
    
    return $target_path;
}

// 요청에 따라 CRUD 기능 분기
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'create':
        // 파일 업로드 처리
        if (isset($_FILES['image'])) {
            $target_dir = "uploads/";
            if (!file_exists($target_dir)) {
                mkdir($target_dir, 0777, true);
            }
            
            $target_file = $target_dir . basename($_FILES["image"]["name"]);
            $imageFileType = strtolower(pathinfo($target_file,PATHINFO_EXTENSION));
            
            // 이미지 파일 검증
            $allowed_types = array('jpg', 'jpeg', 'png', 'gif', 'webp');
            if (!in_array($imageFileType, $allowed_types)) {
                echo json_encode(["error" => "Sorry, only JPG, JPEG, PNG, GIF & WEBP files are allowed."]);
                exit;
            }
            
            if (move_uploaded_file($_FILES["image"]["tmp_name"], $target_file)) {
                $image_url = $conn->real_escape_string($target_file);
            } else {
                echo json_encode(["error" => "Image upload failed"]);
                exit;
            }
        } else {
            echo json_encode(["error" => "No image file uploaded"]);
            exit;
        }

        // POST 데이터 처리
        $title = $conn->real_escape_string($_POST['title']);
        $production_year = $conn->real_escape_string($_POST['production_year']);
        $client = $conn->real_escape_string($_POST['client']);
        $format = $conn->real_escape_string($_POST['format']);
        $youtube_url = $conn->real_escape_string($_POST['youtube_url']);
        $category = $conn->real_escape_string($_POST['category']);
        $score = (int)$_POST['score'];
        $type = $conn->real_escape_string($_POST['type']);

        $sql = "INSERT INTO projects (
            title, 
            production_year, 
            client, 
            format, 
            youtube_url, 
            category, 
            score, 
            image,
            type
        ) VALUES (
            '$title', 
            '$production_year', 
            '$client', 
            '$format', 
            '$youtube_url', 
            '$category', 
            $score, 
            '$image_url',
            '$type'
        )";

        if ($conn->query($sql) === TRUE) {
            echo json_encode([
                "message" => "Record created successfully",
                "data" => [
                    "title" => $title,
                    "productionDate" => $production_year,
                    "client" => $client,
                    "format" => $format,
                    "youtube_url" => $youtube_url,
                    "category" => $category,
                    "score" => $score,
                    "image" => $image_url,
                    "type" => $type
                ]
            ]);
        } else {
            echo json_encode(["error" => "Error: " . $conn->error]);
        }
        break;

    case 'read':
        $sql = "SELECT 
            id,
            title,
            production_year as productionDate,
            client,
            youtube_url as id,
            category,
            image,
            type
            FROM projects 
            ORDER BY score DESC";
        
        $result = $conn->query($sql);
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $youtube_id = '';
            if (preg_match('/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/', $row['id'], $matches)) {
                $youtube_id = $matches[1];
            }
            $row['id'] = $youtube_id;
            $data[] = $row;
        }
        echo json_encode($data);
        break;

    case 'update':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = (int)$data['id']; // Assuming each entry has a unique ID
        $title = $conn->real_escape_string($data['title']);
        $production_year = $conn->real_escape_string($data['production_year']);
        $client = $conn->real_escape_string($data['client']);
        $format = $conn->real_escape_string($data['format']);
        $youtube_url = $conn->real_escape_string($data['youtube_url']);
        $category = $conn->real_escape_string($data['category']);
        $score = (int)$data['score'];

        $sql = "UPDATE projects SET title='$title', production_year='$production_year', client='$client',
                format='$format', youtube_url='$youtube_url', category='$category', score=$score WHERE id=$id";
        if ($conn->query($sql) === TRUE) {
            echo json_encode(["message" => "Record updated successfully"]);
        } else {
            echo json_encode(["error" => "Error: " . $conn->error]);
        }
        break;

    case 'delete':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = (int)$data['id'];
        $sql = "DELETE FROM projects WHERE id=$id";
        if ($conn->query($sql) === TRUE) {
            echo json_encode(["message" => "Record deleted successfully"]);
        } else {
            echo json_encode(["error" => "Error: " . $conn->error]);
        }
        break;

    default:
        echo json_encode(["error" => "Invalid action"]);
}


// 연결 종료
$conn->close();
?>
