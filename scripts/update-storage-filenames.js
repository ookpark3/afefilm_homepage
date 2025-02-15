import { initializeApp } from 'firebase/app';
import {
  getStorage,
  ref,
  listAll,
  getMetadata,
  updateMetadata,
  getBytes,
  uploadBytes,
  deleteObject,
} from 'firebase/storage';

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
const storage = getStorage(app);

// 파일명 디코딩 함수
function decodeFileName(fileName) {
  try {
    // 이중 인코딩 해제 및 디코딩
    let decodedName = fileName.replace(/%25/g, '%').replace(/%2F/gi, '/');

    decodedName = decodeURIComponent(decodedName);

    // 언어 태그 변환
    return decodedName.replace(/(\(\w{3}\))/gi, (match) => {
      const langMap = { ENG: '영문', KOR: '국문', CHN: '중문', JPN: '일문' };
      return `(${langMap[match.slice(1, -1)] || match.slice(1, -1)})`;
    });
  } catch (error) {
    console.error('파일명 디코딩 실패:', error);
    return fileName;
  }
}

async function updateStorageFilenames() {
  try {
    const thumbnailsRef = ref(storage, 'thumbnails');
    console.log('스토리지 파일 스캔 시작...');
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const result = await listAll(thumbnailsRef);

    for (const yearFolder of result.prefixes) {
      const yearFiles = await listAll(yearFolder);
      const yearPath = yearFolder.fullPath;

      for (const fileRef of yearFiles.items) {
        console.log('\n현재 파일:', fileRef.fullPath);

        try {
          const metadata = await getMetadata(fileRef);
          const originalName = metadata.name;
          const nameWithoutYear = originalName.split('/').pop();
          const decodedName = decodeFileName(nameWithoutYear);

          if (nameWithoutYear !== decodedName) {
            console.log('원본 파일명:', nameWithoutYear);
            console.log('변환된 파일명:', decodedName);

            // 1. 파일 데이터 가져오기
            const fileData = await getBytes(fileRef);

            // 2. 새 경로로 파일 업로드
            const newPath = `${yearPath}/${decodedName}`;
            const newRef = ref(storage, newPath);

            // 3. 기존 메타데이터에서 name 필드 제거 (자동 생성되므로)
            const { name, fullPath, ...restMetadata } = metadata;

            // 4. 새 위치에 파일 업로드
            await uploadBytes(newRef, fileData, {
              ...restMetadata,
              customMetadata: {
                ...restMetadata.customMetadata,
                originalName: nameWithoutYear,
              },
            });

            // 5. 원본 파일 삭제
            await deleteObject(fileRef);

            console.log('✅ 파일 이름 변경 완료');
            updated++;
          } else {
            console.log('변경 불필요, 건너뜀');
            skipped++;
          }
        } catch (error) {
          console.error('파일 처리 실패:', error);
          console.error(error.stack);
          errors++;
        }

        // API 제한 방지를 위한 지연
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log('\n작업 완료!');
    console.log(`성공: ${updated}`);
    console.log(`건너뜀: ${skipped}`);
    console.log(`실패: ${errors}`);
  } catch (error) {
    console.error('실행 실패:', error);
    console.error(error.stack);
  } finally {
    process.exit();
  }
}

// 실행
updateStorageFilenames();
