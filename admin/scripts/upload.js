import { app, db, storage, auth } from './firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  uploadBytes,
} from 'firebase/storage';
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';

// upload.js 최상단에 추가
console.log('🔥 스크립트 파일 로드 확인');

// DOM 로드 완료 이벤트 확인
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded 이벤트 트리거');
  console.log(
    '🔎 multi-select 컨테이너 개수:',
    document.querySelectorAll('.multi-select-container').length,
  );
  initMultiSelect();
  initFileDrop();
  console.log('🔧 uploadLogic 초기화 시작');
  uploadLogic(db, storage); // Firebase 인스턴스로 초기화
  console.log('✅ uploadLogic 초기화 완료');

  contentManager = new ContentManager(db, storage);
  contentManager.loadContents();
});

/**
 * 다중 선택 초기화 함수
 * 모든 다중 선택 컨테이너를 찾아 반복 처리하여 초기화 작업을 수행합니다.
 */
function initMultiSelect() {
  console.log('🎯 initMultiSelect 시작');

  document.querySelectorAll('.multi-select-container').forEach((container) => {
    const availableOptions = container.querySelector('.available-options');
    const hiddenInput = container.querySelector('input[type="hidden"]');

    availableOptions.querySelectorAll('.option').forEach((option) => {
      option.addEventListener('click', () => {
        option.classList.toggle('selected');

        // 선택된 옵션들의 값을 히든 인풋에 업데이트
        const selectedValues = Array.from(
          availableOptions.querySelectorAll('.option.selected'),
        )
          .map((opt) => opt.dataset.value)
          .filter(Boolean);

        hiddenInput.value = selectedValues.join(',');
      });
    });
  });
}

// 상수 정의 이동
const ALLOWED_EMAILS = ['ookpark3@gmail.com', 'afefilm82@gmail.com'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const REQUIRED_FIELDS = [
  'videoId',
  'title',
  'productionDate',
  'client',
  'score',
];

// WebP 변환 함수 수정
async function convertToWebP(file, title, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // 720p 해상도로 리사이징 계산
      const TARGET_HEIGHT = 720;
      const TARGET_WIDTH = 1280;

      let newWidth, newHeight;
      const aspectRatio = img.width / img.height;

      if (aspectRatio > TARGET_WIDTH / TARGET_HEIGHT) {
        // 너비가 더 긴 경우
        newWidth = TARGET_WIDTH;
        newHeight = TARGET_WIDTH / aspectRatio;
      } else {
        // 높이가 더 긴 경우
        newHeight = TARGET_HEIGHT;
        newWidth = TARGET_HEIGHT * aspectRatio;
      }

      // 캔버스 크기 설정
      canvas.width = newWidth;
      canvas.height = newHeight;

      // 이미지 스무딩 활성화
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 이미지 그리기
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      console.log(
        `🖼️ 리사이징: ${img.width}x${img.height} → ${newWidth}x${newHeight}`,
      );

      // WebP로 변환 - 파일명을 title로 변경
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('WebP 변환 실패'));
            return;
          }

          // 제목에서 파일명으로 사용할 수 없는 문자 제거 및 공백을 언더스코어로 변경
          const safeTitle = title
            .replace(/[^a-zA-Z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '_');
          const fileName = `${safeTitle}.webp`;
          resolve(new File([blob], fileName, { type: 'image/webp' }));
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => reject(new Error('이미지 로드 실패'));

    // File을 Data URL로 변환
    const reader = new FileReader();
    reader.onload = (e) => (img.src = e.target.result);
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

// 상수 정의
const ITEMS_PER_PAGE = 10; // 한 페이지당 항목 수 조정

// 목록 관리 클래스
class ContentManager {
  constructor(db, storage) {
    this.db = db;
    this.storage = storage;
    this.currentPage = 1;
    this.filters = {
      year: '',
      type: '',
      category: '',
    };
    this.isLoading = false;

    // 모달 초기화 추가
    this.initializeModal();
    this.initializeListeners();
  }

  // 이벤트 리스너 초기화
  initializeListeners() {
    // 필터 변경 이벤트
    document.getElementById('yearFilter').addEventListener('change', (e) => {
      this.filters.year = e.target.value;
      this.currentPage = 1;
      this.loadContents();
    });

    document.getElementById('typeFilter').addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.currentPage = 1;
      this.loadContents();
    });

    document
      .getElementById('categoryFilter')
      .addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.currentPage = 1;
        this.loadContents();
      });

    // 페이지네이션 이벤트
    document.getElementById('prevPage').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadContents();
      }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
      this.currentPage++;
      this.loadContents();
    });
  }

  // 콘텐츠 로드
  async loadContents() {
    if (this.isLoading) {
      console.log('⚠️ 이미 로딩 중, 중복 호출 방지');
      return;
    }

    try {
      this.isLoading = true;
      console.group('📚 콘텐츠 로드 시작');

      // 쿼리 구성 수정 - score를 기준으로 내림차순 정렬
      let queryConstraints = [
        orderBy('score', 'desc'), // score 높은 순으로 정렬
      ];

      // 연도 필터 추가
      if (this.filters.year) {
        queryConstraints.push(
          where('productionDate', '==', parseInt(this.filters.year)),
        );
      }

      // 쿼리 실행
      const q = query(collection(this.db, 'projects'), ...queryConstraints);

      console.log('🔍 실행될 쿼리:', q);
      const querySnapshot = await getDocs(q);
      console.log('📊 초기 문서 개수:', querySnapshot.size, '개');
      console.log(
        '📄 문서 데이터:',
        querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      );

      let contents = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 메모리에서 type과 category 필터링
      if (this.filters.type) {
        const beforeTypeFilterCount = contents.length;
        contents = contents.filter(
          (content) => content.type && content.type.includes(this.filters.type),
        );
        console.log(
          `🔍 유형 필터 적용: ${beforeTypeFilterCount} → ${contents.length}개`,
        );
      }

      if (this.filters.category) {
        const beforeCategoryFilterCount = contents.length;
        contents = contents.filter(
          (content) =>
            content.category &&
            content.category.includes(this.filters.category),
        );
        console.log(
          `🏷️ 카테고리 필터 적용: ${beforeCategoryFilterCount} → ${contents.length}개`,
        );
      }

      // 페이지네이션 적용
      const startIndex = (this.currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedContents = contents.slice(
        startIndex,
        startIndex + ITEMS_PER_PAGE,
      );
      console.log(
        `📄 페이지네이션 적용: ${startIndex + 1}~${startIndex + paginatedContents.length}번째 항목`,
      );

      // 렌더링
      this.renderContents(paginatedContents);
      this.renderPagination(contents.length);

      console.log(`📚 콘텐츠 로드 완료. 총 ${contents.length}개 항목 처리`);
    } catch (error) {
      console.error('콘텐츠 로드 실패:', error);
      alert('콘텐츠 로드 중 오류가 발생했습니다.');
    } finally {
      this.isLoading = false;
      console.groupEnd();
    }
  }

  // 페이지네이션 UI 렌더링 함수 추가
  renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const paginationContainer = document.querySelector('.pagination');

    let paginationHTML = `
        <div class="pagination-info">
            총 ${totalItems}개 항목 중 ${(this.currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(this.currentPage * ITEMS_PER_PAGE, totalItems)}
        </div>
        <div class="pagination-controls">
            <button class="page-btn" data-action="first" ${this.currentPage === 1 ? 'disabled' : ''}>
                ≪
            </button>
            <button class="page-btn" data-action="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
                ＜
            </button>
    `;

    // 페이지 번호 버튼
    for (
      let i = Math.max(1, this.currentPage - 2);
      i <= Math.min(totalPages, this.currentPage + 2);
      i++
    ) {
      paginationHTML += `
            <button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    paginationHTML += `
            <button class="page-btn" data-action="next" ${this.currentPage === totalPages ? 'disabled' : ''}>
                ＞
            </button>
            <button class="page-btn" data-action="last" ${this.currentPage === totalPages ? 'disabled' : ''}>
                ≫
            </button>
        </div>
    `;

    paginationContainer.innerHTML = paginationHTML;

    // 페이지네이션 버튼 이벤트 리스너
    paginationContainer.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const page = btn.dataset.page;

        if (action) {
          switch (action) {
            case 'first':
              this.currentPage = 1;
              break;
            case 'last':
              this.currentPage = totalPages;
              break;
            case 'prev':
              this.currentPage = Math.max(1, this.currentPage - 1);
              break;
            case 'next':
              this.currentPage = Math.min(totalPages, this.currentPage + 1);
              break;
          }
        } else if (page) {
          this.currentPage = parseInt(page);
        }

        this.loadContents();
      });
    });
  }

  // 콘텐츠 렌더링
  renderContents(contents) {
    const container = document.getElementById('contentList');

    if (contents.length === 0) {
      container.innerHTML = `
            <div class="no-content">
                <p>표시할 콘텐츠가 없습니다.</p>
            </div>
        `;
      return;
    }

    container.innerHTML = contents
      .map(
        (content) => `
        <div class="content-item" data-id="${content.id}">
            <div class="content-thumbnail">
                <img src="${content.thumbnail}" alt="${content.title}">
            </div>
            <div class="content-info">
                <h3>${content.title}</h3>
                <div class="content-details">
                    <p><strong>점수:</strong> ${content.score}</p>
                    <p><strong>제목:</strong> ${content.title}</p>
                    <p><strong>클라이언트:</strong> ${content.client}</p>
                    <p><strong>제작연도:</strong> ${content.productionDate}</p>
                    <p><strong>카테고리:</strong> ${content.category.join(', ')}</p>
                    <p><strong>유형:</strong> ${content.type.join(', ')}</p>
                </div>
                <div class="content-actions">
                    <button class="edit-btn" onclick="editContent('${content.id}')">수정</button>
                    <button class="delete-btn" onclick="deleteContent('${content.id}')">삭제</button>
                </div>
            </div>
        </div>
    `,
      )
      .join('');
  }

  // 콘텐츠 삭제
  async deleteContent(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const docRef = doc(this.db, 'projects', id);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();

      // 썸네일 파일 삭제
      if (data.thumbnail) {
        const storageRef = ref(this.storage, data.thumbnail);
        await deleteObject(storageRef);
      }

      // Firestore 문서 삭제
      await deleteDoc(docRef);

      alert('삭제되었습니다.');
      this.loadContents();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }

  // 모달 초기화 함수 수정
  initializeModal() {
    const modalHTML = `
        <div id="editModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>콘텐츠 수정</h2>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editForm">
                        <input type="hidden" id="modal-docId">
                        <div class="form-group">
                            <label for="modal-videoId">YouTube 영상 링크</label>
                            <input type="text" id="modal-videoId" required>
                        </div>
                        <div class="form-group">
                            <label for="modal-title">영상 제목</label>
                            <input type="text" id="modal-title" required>
                        </div>
                        <div class="form-group">
                            <label for="modal-productionDate">제작년도</label>
                            <input type="number" id="modal-productionDate" required>
                        </div>
                        <div class="form-group">
                            <label for="modal-client">클라이언트</label>
                            <input type="text" id="modal-client" required>
                        </div>
                        <div class="form-group">
                            <label for="modal-score">점수</label>
                            <input type="number" id="modal-score" required>
                        </div>
                        
                        <div class="form-group">
                            <label>유형 선택 (다중 선택 가능)</label>
                            <div class="multi-select-container">
                                <div class="available-options">
                                    <div class="option" data-value="콘텐츠">콘텐츠</div>
                                    <div class="option" data-value="광고">광고</div>
                                    <div class="option" data-value="뮤직비디오">뮤직비디오</div>
                                    <div class="option" data-value="공기관">공기관</div>
                                    <div class="option" data-value="스케치">스케치</div>
                                </div>
                                <input type="hidden" id="modal-type" name="type">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>카테고리 선택 (다중 선택 가능)</label>
                            <div class="multi-select-container">
                                <div class="available-options">
                                    <div class="option" data-value="콘텐츠">콘텐츠</div>
                                    <div class="option" data-value="기업">기업</div>
                                    <div class="option" data-value="공공기관">공공기관</div>
                                    <div class="option" data-value="아트필름">아트필름</div>
                                </div>
                                <input type="hidden" id="modal-category" name="category">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="modal-thumbnail">썸네일 이미지</label>
                            <div class="thumbnail-container">
                                <img id="modal-thumbnail-preview" src="" alt="현재 썸네일">
                                <input type="file" id="modal-thumbnail" accept="image/*">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="cancel-btn">취소</button>
                    <button type="button" class="save-btn">저장</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // 모달 초기화 후 멀티셀렉트 이벤트 리스너 추가
    this.initModalMultiSelect();
    this.initModalThumbnail();

    // 모달 초기화 후 버튼 이벤트 리스너 추가
    const modal = document.getElementById('editModal');
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');

    // 닫기 버튼
    closeBtn.addEventListener('click', () => this.closeModal());

    // 취소 버튼
    cancelBtn.addEventListener('click', () => this.closeModal());

    // 저장 버튼
    saveBtn.addEventListener('click', () => this.saveEdit());

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        this.closeModal();
      }
    });

    // 모달 외부 클릭시 닫기
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
  }

  // 모달의 멀티셀렉트 초기화
  initModalMultiSelect() {
    const modal = document.getElementById('editModal');
    modal.querySelectorAll('.multi-select-container').forEach((container) => {
      const options = container.querySelectorAll('.option');
      const hiddenInput = container.querySelector('input[type="hidden"]');

      options.forEach((option) => {
        option.addEventListener('click', () => {
          option.classList.toggle('selected');
          const selectedValues = Array.from(
            container.querySelectorAll('.option.selected'),
          )
            .map((opt) => opt.dataset.value)
            .filter(Boolean);
          hiddenInput.value = selectedValues.join(',');
        });
      });
    });
  }

  // 모달의 썸네일 초기화
  initModalThumbnail() {
    const thumbnailInput = document.getElementById('modal-thumbnail');
    const preview = document.getElementById('modal-thumbnail-preview');

    thumbnailInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const webpFile = await convertToWebP(file);
          const reader = new FileReader();
          reader.onload = (e) => {
            preview.src = e.target.result;
          };
          reader.readAsDataURL(webpFile);
        } catch (error) {
          console.error('썸네일 변환 실패:', error);
          alert('썸네일 처리 중 오류가 발생했습니다.');
        }
      }
    });
  }

  // editContent 메서드 수정
  async editContent(id) {
    try {
      const docRef = doc(this.db, 'projects', id);
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();

      // 기본 필드 설정
      document.getElementById('modal-videoId').value = data.videoId;
      document.getElementById('modal-title').value = data.title;
      document.getElementById('modal-productionDate').value =
        data.productionDate;
      document.getElementById('modal-client').value = data.client;
      document.getElementById('modal-score').value = data.score;
      document.getElementById('modal-docId').value = id;

      // 썸네일 미리보기 설정
      const thumbnailPreview = document.getElementById(
        'modal-thumbnail-preview',
      );
      thumbnailPreview.src = data.thumbnail;

      // 유형과 카테고리 선택 설정
      this.setModalMultiSelectValues('modal-type', data.type);
      this.setModalMultiSelectValues('modal-category', data.category);

      // 모달 표시
      document.getElementById('editModal').style.display = 'block';
    } catch (error) {
      console.error('수정 준비 실패:', error);
      alert('수정 준비 중 오류가 발생했습니다.');
    }
  }

  // 모달의 멀티셀렉트 값 설정
  setModalMultiSelectValues(inputId, values) {
    const container = document
      .getElementById(inputId)
      .closest('.multi-select-container');
    container.querySelectorAll('.option').forEach((option) => {
      option.classList.toggle(
        'selected',
        values.includes(option.dataset.value),
      );
    });
    document.getElementById(inputId).value = values.join(',');
  }

  // saveEdit 메서드 수정 - WebP 변환 로직 추가
  async saveEdit() {
    try {
      const docId = document.getElementById('modal-docId').value;
      const thumbnailFile = document.getElementById('modal-thumbnail').files[0];
      let thumbnailUrl = document.getElementById('modal-thumbnail-preview').src;

      // 새 썸네일이 선택된 경우
      if (thumbnailFile) {
        let webpFile;

        // 이미 WebP 파일인지 확인
        if (thumbnailFile.type === 'image/webp') {
          webpFile = thumbnailFile;
        } else {
          console.log('WebP 변환 시작:', thumbnailFile.name);
          webpFile = await convertToWebP(thumbnailFile);
          console.log('WebP 변환 완료:', webpFile.name);
        }

        const productionYear = document.getElementById(
          'modal-productionDate',
        ).value;
        const storagePath = `thumbnails/${productionYear}/${Date.now()}_${webpFile.name}`;
        const storageRef = ref(this.storage, storagePath);

        console.log('파일 업로드 시작:', storagePath);
        await uploadBytes(storageRef, webpFile);
        thumbnailUrl = await getDownloadURL(storageRef);
        console.log('파일 업로드 완료:', thumbnailUrl);
      }

      // 유효성 검사 추가
      const formData = {
        videoId: document.getElementById('modal-videoId').value.trim(),
        title: document.getElementById('modal-title').value.trim(),
        productionDate: parseInt(
          document.getElementById('modal-productionDate').value,
        ),
        client: document.getElementById('modal-client').value.trim(),
        score: parseInt(document.getElementById('modal-score').value),
        type: document
          .getElementById('modal-type')
          .value.split(',')
          .filter(Boolean),
        category: document
          .getElementById('modal-category')
          .value.split(',')
          .filter(Boolean),
      };

      // 필수 필드 검증
      const requiredFields = [
        'videoId',
        'title',
        'productionDate',
        'client',
        'score',
      ];
      const emptyFields = requiredFields.filter((field) => !formData[field]);

      if (emptyFields.length > 0) {
        throw new Error(`다음 필드를 입력해주세요: ${emptyFields.join(', ')}`);
      }

      // 점수 범위 검증
      if (formData.score < 1 || formData.score > 9) {
        throw new Error('점수는 1에서 9 사이여야 합니다.');
      }

      // Firestore 업데이트
      const docRef = doc(this.db, 'projects', docId);
      await updateDoc(docRef, {
        ...formData,
        thumbnail: thumbnailUrl,
        updatedAt: serverTimestamp(),
      });

      this.closeModal();
      this.loadContents();
      alert('수정이 완료되었습니다.');
    } catch (error) {
      console.error('수정 저장 실패:', error);
      alert(error.message || '수정 저장 중 오류가 발생했습니다.');
    }
  }

  // closeModal 메서드 수정
  closeModal() {
    const modal = document.getElementById('editModal');
    const form = document.getElementById('editForm');

    // 폼 초기화
    form.reset();

    // 멀티셀렉트 초기화
    modal.querySelectorAll('.option').forEach((option) => {
      option.classList.remove('selected');
    });

    // 썸네일 미리보기 초기화
    const thumbnailPreview = document.getElementById('modal-thumbnail-preview');
    thumbnailPreview.src = '';

    // 모달 숨기기
    modal.style.display = 'none';
  }
}

// 전역 변수로 ContentManager 인스턴스 저장
let contentManager;

// 초기화 함수 수정
function initializeApp() {
  console.log('🔥 스크립트 파일 로드 확인');

  // 이미 초기화되었는지 확인
  if (contentManager) {
    console.log('⚠️ 이미 초기화됨, 중복 초기화 방지');
    return;
  }

  console.log('🚀 DOMContentLoaded 이벤트 트리거');
  const multiSelectContainers = document.querySelectorAll(
    '.multi-select-container',
  );
  console.log('🔎 multi-select 컨테이너 개수:', multiSelectContainers.length);

  // 멀티셀렉트 초기화
  multiSelectContainers.forEach((container) => initMultiSelect(container));

  console.log('🔧 uploadLogic 초기화 시작');
  uploadLogic(db, storage);
  console.log('✅ uploadLogic 초기화 완료');

  // ContentManager 초기화
  contentManager = new ContentManager(db, storage);
  contentManager.loadContents();
}

// 이벤트 리스너 수정
document.addEventListener('DOMContentLoaded', initializeApp, { once: true });

// 전역 함수로 노출 (onclick 이벤트에서 사용)
window.deleteContent = (id) => contentManager.deleteContent(id);
window.editContent = (id) => contentManager.editContent(id);

// 업로드 로직 핵심 부분 수정
export const uploadLogic = (db, storage) => {
  console.log('📥 uploadLogic 함수 진입');
  const form = document.getElementById('uploadForm');
  if (!form) {
    console.error('❌ uploadForm을 찾을 수 없음');
    return;
  }

  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  const showProgress = (percentage) => {
    console.log(`📊 진행률 업데이트: ${percentage}%`);
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
  };

  const validateForm = () => {
    console.log('🔍 폼 유효성 검사 시작');
    const errors = [];

    // 필수 필드 검증
    REQUIRED_FIELDS.forEach((field) => {
      const value = document.getElementById(field).value.trim();
      console.log(`📝 필드 검사: ${field} = ${value}`);
      if (!value) {
        errors.push(`${field} 필드는 필수 입력입니다`);
      }
    });

    // 영상 ID 유효성 검사
    const videoId = extractVideoId(document.getElementById('videoId').value);
    console.log(`🎥 영상 ID 추출 결과: ${videoId}`);
    if (!videoId) errors.push('유효한 YouTube 영상 ID가 아닙니다');

    // 파일 검증
    const thumbnailFile = document.getElementById('thumbnail').files[0];
    if (!thumbnailFile) {
      console.log('🖼️ 썸네일 파일 없음');
      errors.push('썸네일 이미지를 선택해주세요');
    } else {
      console.log(
        `📁 파일 정보: ${thumbnailFile.name} (${thumbnailFile.size} bytes)`,
      );
      if (thumbnailFile.size > MAX_FILE_SIZE) {
        errors.push('파일 크기는 5MB를 초과할 수 없습니다');
      }
    }

    console.log(`✅ 유효성 검사 완료. 오류 수: ${errors.length}`);
    return { isValid: errors.length === 0, errors };
  };

  form.addEventListener('submit', async (e) => {
    console.groupCollapsed('🚀 폼 제출 시작');
    e.preventDefault();

    try {
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      console.log('⏳ 제출 버튼 비활성화');
      showProgress(10);

      // 1. 폼 데이터 검증
      console.log('🔎 폼 검증 시작');
      const validation = validateForm();
      if (!validation.isValid) {
        console.error('❌ 폼 검증 실패:', validation.errors);
        throw new Error(validation.errors.join('\n'));
      }
      console.log('✅ 폼 검증 통과');

      // 2. 파일 업로드 - WebP 변환 추가
      console.log('📤 파일 업로드 시작');
      const originalFile = document.getElementById('thumbnail').files[0];
      const productionYear = document.getElementById('productionDate').value;
      const title = document.getElementById('title').value.trim();

      console.log('🔄 WebP 변환 시작');
      const webpFile = await convertToWebP(originalFile, title);
      console.log('✅ WebP 변환 완료:', webpFile.size, 'bytes');

      // 연도별 폴더 구조에 제목 기반 파일명으로 저장
      const storagePath = `thumbnails/${productionYear}/${webpFile.name}`;
      console.log(`📂 저장 경로: ${storagePath}`);

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, webpFile);

      const snapshot = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 90;
            console.log(`📈 업로드 진행률: ${progress.toFixed(2)}%`);
            showProgress(progress);
          },
          (error) => {
            console.error('❌ 파일 업로드 오류:', error);
            reject(error);
          },
          () => {
            console.log('✅ 파일 업로드 완료');
            resolve(uploadTask.snapshot);
          },
        );
      });
      console.log('📦 스냅샷 정보:', snapshot);

      // 3. 다운로드 URL 획득 및 변환
      console.log('🔗 다운로드 URL 가져오기');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('📎 원본 다운로드 URL:', downloadURL);

      // Firebase Storage URL을 GCS URL로 변환
      const gcsUrl = downloadURL
        .replace(
          'https://firebasestorage.googleapis.com/v0/b/',
          'https://storage.googleapis.com/',
        )
        .replace('/o/', '/') // o/ 경로 제거
        .split('?')[0]; // 토큰 파라미터 제거

      console.log('📎 변환된 GCS URL:', gcsUrl);

      // 4. Firestore 저장
      console.log('📝 Firestore 저장 시작');
      const isEditMode = form.dataset.mode === 'edit';
      const docId = form.dataset.editId;

      const projectData = {
        videoId: extractVideoId(document.getElementById('videoId').value),
        title: document.getElementById('title').value.trim(),
        productionDate: parseInt(
          document.getElementById('productionDate').value,
        ),
        client: document.getElementById('client').value.trim(),
        score: parseInt(document.getElementById('score').value),
        type: document.getElementById('type').value.split(',').filter(Boolean),
        category: document
          .getElementById('category')
          .value.split(',')
          .filter(Boolean),
        thumbnail: gcsUrl, // 변환된 URL 사용
        updatedAt: serverTimestamp(),
      };
      console.log('📄 저장할 프로젝트 데이터:', projectData);

      if (isEditMode) {
        await updateDoc(doc(db, 'projects', docId), projectData);
        console.log('🔄 문서 수정 완료 ID:', docId);
      } else {
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        console.log('✨ 새 문서 저장 완료 ID:', docRef.id);
      }

      // 폼 초기화
      form.reset();
      form.dataset.mode = 'create';
      delete form.dataset.editId;
      document.querySelector('.preview-container').innerHTML = '';

      // 목록 새로고침
      contentManager.loadContents();

      alert(isEditMode ? '수정되었습니다!' : '업로드가 완료되었습니다!');
    } catch (error) {
      console.error('❌ 업로드 오류:', error);
      alert(`업로드 실패:\n${error.message}`);
      showProgress(0);
    } finally {
      console.log('🔓 제출 버튼 활성화');
      document.getElementById('submitBtn').disabled = false;
      console.groupEnd();
    }
    console.log('✅ 폼 제출 핸들러 등록 완료');
  });

  // 실시간 유효성 검사 추가
  document.getElementById('videoId').addEventListener('input', (e) => {
    const input = e.target.value;
    const isValid = extractVideoId(input)?.length === 11;
    console.log(
      `🎥 영상 ID 유효성 검사: ${input} -> ${isValid ? '유효' : '무효'}`,
    );
    e.target.classList.toggle('invalid', !isValid);
  });

  // 실시간 유효성 검사
  document.getElementById('thumbnail').addEventListener('change', (e) => {
    const file = e.target.files[0];
    console.log(`🖼️ 선택된 파일: ${file?.name} (${file?.size} bytes)`);
    if (file.size > 5 * 1024 * 1024) {
      console.log('❌ 파일 크기 초과');
      alert('5MB 이하 파일만 업로드 가능합니다');
      e.target.value = '';
    }
    handleImagePreview(file);
  });

  // 초기화
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 uploadLogic 내부 DOMContentLoaded');
    initMultiSelect();
  });
};

// 상수 정의
const AUTH_ERRORS = {
  invalid_email: '허용되지 않은 이메일입니다',
  popup_blocked: '팝업이 차단되었습니다. 브라우저 설정을 확인해주세요',
  default: '인증 오류가 발생했습니다',
};

const provider = new GoogleAuthProvider();

// 인증 상태 리스너
const initAuth = () => {
  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user || !ALLOWED_EMAILS.includes(user.email)) {
        await handleUnauthorizedAccess();
        return;
      }
      console.log('✅ 인증된 사용자:', user.email);
    } catch (error) {
      console.error('인증 상태 오류:', error);
      window.location.href = '/admin/';
    }
  });
};

// 미인증 처리
const handleUnauthorizedAccess = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!ALLOWED_EMAILS.includes(user.email)) {
      await signOut(auth);
      throw new Error(AUTH_ERRORS.invalid_email);
    }

    console.log('✅ 성공적으로 로그인:', user.email);
    window.location.reload();
  } catch (error) {
    handleAuthError(error);
  }
};

// 에러 처리
const handleAuthError = (error) => {
  const errorMap = {
    'auth/popup-blocked': AUTH_ERRORS.popup_blocked,
    'auth/unauthorized-domain': '허용되지 않은 도메인입니다',
  };

  alert(errorMap[error.code] || AUTH_ERRORS.default);
  console.error('인증 오류:', error);
  window.location.href = '/admin/';
};

// DOM 초기화
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  // 로그아웃 버튼 초기화
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).then(() => window.location.reload());
    });
  }
});

// 기존 코드에 추가
function initFileDrop() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('thumbnail');
  const previewContainer = document.querySelector('.preview-container');

  // 드래그 오버 시 스타일 변경
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  // 드래그 리브 시 스타일 복원
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  // 파일 드롭 처리
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    console.groupCollapsed('🖱 파일 드롭 이벤트');

    const files = e.dataTransfer.files;
    console.log('드롭된 파일 개수:', files.length);
    console.log('첫 번째 파일 정보:', {
      name: files[0]?.name,
      type: files[0]?.type,
      size: files[0]?.size,
    });

    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
    console.groupEnd();
  });

  // 파일 선택 변경 시 처리
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // 파일 처리 공통 함수
  function handleFileSelection(file) {
    try {
      console.groupCollapsed('📁 파일 처리 시작');
      console.log('선택된 파일:', file);

      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB를 초과할 수 없습니다');
        return;
      }

      // 프리뷰 표시
      const reader = new FileReader();
      reader.onload = (e) => {
        previewContainer.innerHTML = `
          <div class="image-preview">
            <img src="${e.target.result}" alt="미리보기">
            <button type="button" class="remove-btn">×</button>
          </div>
        `;

        // 삭제 버튼 이벤트 바인딩
        previewContainer
          .querySelector('.remove-btn')
          .addEventListener('click', () => {
            fileInput.value = '';
            previewContainer.innerHTML = '';
          });
      };
      reader.readAsDataURL(file);

      // 파일 입력 업데이트 디버깅
      console.log('업데이트 전 파일 입력 값:', fileInput.value);
      console.log('업데이트 전 files.length:', fileInput.files.length);

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      console.log('업데이트 후 파일 입력 값:', fileInput.value);
      console.log('업데이트 후 files.length:', fileInput.files.length);
      console.log('업데이트 후 files[0]:', fileInput.files[0]);

      // 이벤트 리스너 중복 방지
      if (fileInput.files.length > 0 && fileInput.files[0] === file) {
        console.log('동일 파일 재선택 방지');
        return;
      }

      // 변경 이벤트 발생 방식 개선
      if ('createEvent' in document) {
        const event = document.createEvent('HTMLEvents');
        event.initEvent('change', true, false);
        fileInput.dispatchEvent(event);
      } else {
        fileInput.dispatchEvent(new Event('change'));
      }
      console.log('change 이벤트 1회 발생');
    } catch (error) {
      console.error('파일 처리 오류:', error);
    } finally {
      console.groupEnd();
    }
  }
}

// YouTube 영상 ID 추출 함수 추가
function extractVideoId(url) {
  if (!url) return null;

  // 이미 ID 형태인 경우
  if (url.length === 11) return url;

  // URL에서 ID 추출
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);

  return match && match[2].length === 11 ? match[2] : null;
}

// 이미지 미리보기 함수 추가
function handleImagePreview(file) {
  if (!file) return;

  const previewContainer = document.querySelector('.preview-container');
  const reader = new FileReader();

  reader.onload = (e) => {
    previewContainer.innerHTML = `
            <div class="image-preview">
                <img src="${e.target.result}" alt="미리보기">
                <button type="button" class="remove-btn">×</button>
            </div>
        `;

    // 삭제 버튼 이벤트 바인딩
    previewContainer
      .querySelector('.remove-btn')
      .addEventListener('click', () => {
        document.getElementById('thumbnail').value = '';
        previewContainer.innerHTML = '';
      });
  };

  reader.readAsDataURL(file);
}
