import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
} from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: 'AIzaSyBojnMbMLnSzUtbMe8CtOya2nJ1bLEjT5w',
  authDomain: 'afefilmdb.firebaseapp.com',
  projectId: 'afefilmdb',
  storageBucket: 'afefilmdb.firebasestorage.app',
  messagingSenderId: '197138650449',
  appId: '1:197138650449:web:5bc69676959c0a88e46f70',
  measurementId: 'G-DYG08RPJLD',
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// URL 디코딩 함수 수정
function decodeStorageUrl(url) {
  try {
    const baseUrl =
      'https://storage.googleapis.com/afefilmdb.firebasestorage.app';
    const pathPart = url.replace(baseUrl, '');

    // 경로 파싱
    const pathMatch = pathPart.match(/(thumbnails%2F|thumbnails\/)(.*)/i);
    if (!pathMatch) return url;

    // 완전한 디코딩 수행
    const encodedPath = pathMatch[2];
    let decodedPath = encodedPath
      .replace(/%25/g, '%') // 이중 인코딩 해제
      .replace(/%2F/gi, '/'); // 경로 구분자 정규화

    // URL 디코딩 수행
    decodedPath = decodeURIComponent(decodedPath);

    // 언어 태그 변환
    const translated = decodedPath.replace(/(\(\w{3}\))/gi, (match) => {
      const langMap = { ENG: '영문', KOR: '국문', CHN: '중문', JPN: '일문' };
      return `(${langMap[match.slice(1, -1)] || match.slice(1, -1)})`;
    });

    // 디코딩된 상태로 URL 조립 (인코딩하지 않음)
    return `${baseUrl}/thumbnails/${translated}`;
  } catch (error) {
    console.error('URL 처리 실패:', error);
    return url;
  }
}

async function updateThumbnailUrls() {
  try {
    const querySnapshot = await getDocs(collection(db, 'projects'));
    console.log(`총 ${querySnapshot.size}개의 문서 확인됨`);

    let updated = 0;
    let skipped = 0;

    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const oldUrl = data.thumbnail;

      if (!oldUrl) {
        console.log(`⚠️ 썸네일 URL 없음: ${doc.id}`);
        skipped++;
        continue;
      }

      console.log('\n문서 ID:', doc.id);
      console.log('원본 URL:', oldUrl);

      // URL 디코딩 적용
      const decodedUrl = decodeStorageUrl(oldUrl);

      // 실제 파일명 비교
      const oldFileName = oldUrl.split('%2F').pop();
      const newFileName = decodedUrl.split('%2F').pop();

      if (oldFileName !== newFileName) {
        console.log('변환된 URL:', decodedUrl);

        try {
          await updateDoc(doc.ref, {
            thumbnail: decodedUrl,
          });
          console.log('✅ 업데이트 성공');
          updated++;
        } catch (error) {
          console.error('❌ 업데이트 실패:', error);
        }
      } else {
        console.log('변경 불필요, 건너뜀');
        skipped++;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('\n마이그레이션 완료!');
    console.log(`총 문서: ${querySnapshot.size}`);
    console.log(`업데이트: ${updated}`);
    console.log(`건너뜀: ${skipped}`);
  } catch (error) {
    console.error('실행 실패:', error);
  } finally {
    process.exit();
  }
}

// 실행
updateThumbnailUrls();
