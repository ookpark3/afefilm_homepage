<?php
// 모든 API 파일의 상단에 포함시킬 헤더 설정
function setSecureHeaders() {
    // CORS 설정
    header('Access-Control-Allow-Origin: https://afefilm.com'); 
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
    
    // 보안 헤더
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Content-Security-Policy: default-src \'self\'');
    
    // 캐시 컨트롤
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    
    // Content-Type 설정
    header('Content-Type: application/json; charset=UTF-8');
}
?> 