/* CloudFront Function: Viewer Request handler for afefilmweb
 *
 * 기능 요약
 * 1. 루트(/) 접근 시 Accept-Language 헤더를 읽어 /kr/ 또는 /en/ 으로 302 리다이렉트.
 * 2. /kr, /en 요청은 슬래시를 붙인 경로로 301 리다이렉트.
 * 3. /index(.html) → /, /kr/index(.html) → /kr/ 등의 정규화 리다이렉트.
 * 4. 확장자 없는 경로(예: /kr/work)는 S3에 존재하는 HTML 파일(kr/work.html)을 바라보도록
 *    request.uri 에 .html 을 추가.
 * 5. robots.txt, sitemap.xml, naver 검증 파일 등 특수 경로는 예외 처리.
 *
 * CloudFront Functions 는 ES5 문법을 사용해야 하므로 최신 문법을 피합니다.
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var headers = request.headers || {};

  // Host 정규화: www.afefilm.com -> afefilm.com
  var host = (headers.host && headers.host.value) ? headers.host.value.toLowerCase() : '';
  if (host === 'www.afefilm.com') {
    var qs = buildQueryString(request.querystring || {});
    return redirectResponse('https://afefilm.com' + uri + qs, 301);
  }

  // S3에 있는 정적 파일 경로는 그대로 통과
  if (isStaticAsset(uri)) {
    return request;
  }

  // 1. 루트 접근 시 언어별 리다이렉트
  if (uri === '/' || uri === '') {
    var targetLocale = detectLocale(headers);
    return redirectResponse('/' + targetLocale + '/', 302);
  }

  // 2. /kr, /en → 슬래시 추가
  if (uri === '/kr' || uri === '/en') {
    return redirectResponse(uri + '/', 301);
  }

  // 2-a. /admin → /admin/ 정규화
  if (uri === '/admin') {
    return redirectResponse('/admin/', 301);
  }

  // 3. /index.html → /, /kr/index.html → /kr/
  if (uri === '/index' || uri === '/index.html') {
    return redirectResponse('/', 301);
  }
  if (uri === '/kr/index' || uri === '/kr/index.html') {
    return redirectResponse('/kr/', 301);
  }
  if (uri === '/en/index' || uri === '/en/index.html') {
    return redirectResponse('/en/', 301);
  }

  // 4-a. 슬래시로 끝나는 경로는 해당 디렉터리의 index.html로 매핑
  if (uri.length > 1 && uri.charAt(uri.length - 1) === '/') {
    request.uri = uri + 'index.html';
    return request;
  }

  // 4. 확장자 없는 경로는 .html 추가 (이미 슬래시로 끝난다면 그대로 둠)
  if (!hasExtension(uri) && uri.charAt(uri.length - 1) !== '/') {
    request.uri = uri + '.html';
    return request;
  }

  return request;
}

function buildQueryString(qs) {
  var s = '';
  for (var k in qs) {
    if (qs.hasOwnProperty(k)) {
      var obj = qs[k];
      if (obj && obj.value != null) {
        s += (s ? '&' : '?') + encodeURIComponent(k) + '=' + encodeURIComponent(obj.value);
      }
    }
  }
  return s;
}

function detectLocale(headers) {
  var acceptLanguageHeader = headers['accept-language'];
  if (!acceptLanguageHeader || !acceptLanguageHeader.value) {
    return 'en';
  }

  var languages = acceptLanguageHeader.value.split(',');
  for (var i = 0; i < languages.length; i++) {
    var lang = languages[i].trim().toLowerCase();
    if (lang.indexOf('ko') === 0) {
      return 'kr';
    }
  }
  return 'en';
}

function hasExtension(uri) {
  var lastSlashIndex = uri.lastIndexOf('/');
  var filename = lastSlashIndex >= 0 ? uri.substring(lastSlashIndex + 1) : uri;
  return filename.indexOf('.') !== -1;
}

function redirectResponse(location, status) {
  return {
    statusCode: status,
    statusDescription: status === 301 ? 'Moved Permanently' : 'Found',
    headers: {
      location: { value: location },
      'cache-control': { value: 'no-cache' },
    },
  };
}

function isStaticAsset(uri) {
  // 예외 경로: 검증/SEO 파일 및 이미 확장자가 있는 자산
  if (uri === '/robots.txt' || uri === '/sitemap.xml' || uri === '/rss.xml') {
    return true;
  }
  if (uri.indexOf('/naver') === 0) {
    return true;
  }
  return hasExtension(uri);
}
