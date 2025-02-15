import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

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
const storage = getStorage(app);

// URL 디코딩 함수 추가
function decodeStorageUrl(url) {
  try {
    // %25를 %로 먼저 디코딩 (이중 인코딩 처리)
    let decodedUrl = url.replace(/%25/g, '%');

    // URL 구조 분해
    const [basePath, fileName] = decodedUrl.split('/thumbnails/');
    const [year, encodedName] = fileName.split('/');

    // 파일명 디코딩
    const decodedFileName = decodeURIComponent(encodedName);

    // 새로운 URL 조합 (한글은 한 번만 인코딩되도록)
    const newFileName = encodeURIComponent(decodedFileName);
    return `${basePath}/thumbnails/${year}/${newFileName}`;
  } catch (error) {
    console.error('URL 디코딩 실패:', url);
    return url;
  }
}

async function migrateData() {
  try {
    // JSON 파일 읽기
    const jsonPath = path.join(process.cwd(), 'public/asset/work/videos.json');
    const rawData = await fs.readFile(jsonPath, 'utf8');
    const videos = JSON.parse(rawData);

    // 기존 데이터 확인
    const existingDocs = await getDocs(collection(db, 'projects'));
    const existingVideoIds = new Set(
      existingDocs.docs.map((doc) => doc.data().videoId),
    );

    console.log(`기존 문서 수: ${existingDocs.size}`);
    console.log(`총 마이그레이션 대상: ${videos.length}개`);

    const newVideos = videos.filter((video) => !existingVideoIds.has(video.id));
    console.log(`새로 추가할 항목: ${newVideos.length}개`);

    let completed = 0;
    let skipped = videos.length - newVideos.length;

    for (const video of newVideos) {
      try {
        // 이미지 URL에서 WebP 파일 다운로드
        const imageUrl = `https://afefilm.com${video.image}`;
        console.log(`다운로드 중: ${imageUrl}`);

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`이미지 다운로드 실패: ${imageResponse.status}`);
        }
        const imageBuffer = await imageResponse.buffer();

        // Storage에 업로드
        const year = video.productionDate.toString();
        const filename = video.image.split('/').pop(); // 원본 파일명 유지
        const storagePath = `thumbnails/${year}/${filename}`;
        const storageRef = ref(storage, storagePath);

        console.log(`Storage 업로드 중: ${storagePath}`);
        await uploadBytes(storageRef, imageBuffer);

        // GCS URL 형식으로 저장 및 디코딩
        const downloadURL = await getDownloadURL(storageRef);
        const gcsUrl = downloadURL
          .replace(
            'https://firebasestorage.googleapis.com/v0/b/',
            'https://storage.googleapis.com/',
          )
          .replace('/o/', '/') // o/ 경로 제거
          .split('?')[0]; // 토큰 파라미터 제거

        // URL 디코딩 적용
        const thumbnailUrl = decodeStorageUrl(gcsUrl);
        console.log('원본 URL:', gcsUrl);
        console.log('변환된 URL:', thumbnailUrl);

        // Firestore에 데이터 저장
        const docData = {
          videoId: video.id,
          title: video.title,
          productionDate: video.productionDate,
          client: video.client,
          score: video.score,
          thumbnail: thumbnailUrl,
          type: video.type,
          category: video.category,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'projects'), docData);
        completed++;
        console.log(
          `✅ 마이그레이션 완료 (${completed}/${newVideos.length}): ${video.title}`,
        );
      } catch (error) {
        console.error(`❌ 항목 마이그레이션 실패: ${video.title}`);
        console.error(error);
      }

      // API 제한을 위한 지연
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\n마이그레이션 결과:');
    console.log(`✅ 성공: ${completed}개`);
    console.log(`⏭️ 건너뜀: ${skipped}개`);
    console.log(`❌ 실패: ${newVideos.length - completed}개`);
    console.log(`총 처리된 항목: ${videos.length}개`);
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  } finally {
    process.exit();
  }
}

// 마이그레이션 실행
migrateData();
