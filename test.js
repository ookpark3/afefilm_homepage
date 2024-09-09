<script>
document.addEventListener('DOMContentLoaded', async function () {
  // 초기에 body에 no-scroll 클래스 추가
  document.body.classList.add('no-scroll');

  // 요소 선택
  const loadingPage = document.getElementById('loading-page');
  const orbitals = document.querySelectorAll('.orbital');
  const bigCircle = document.querySelector('.big-circle');
  const body = document.body;

  // 로딩 애니메이션 함수
  // 애니메이션 함수 정의
  function animate(time) {
    // 큰 원의 반지름 계산
    const radius = bigCircle.offsetWidth / 2;

    // 모바일 여부 확인
    const isMobile = window.innerWidth <= 768;

    // 각 궤도 요소에 대해 반복
    orbitals.forEach((orbital, index) => {
      // 각도 계산 (시간에 따라 변화, 각 요소마다 120도 간격)
      const angle =
        (time * 0.0003 + index * ((Math.PI * 2) / 3)) % (Math.PI * 2);

      // 모바일에서는 더 작은 반지름 사용
      const adjustedRadius = isMobile ? radius * 0.5 : radius;

      // x, y 좌표 계산 (원 운동)
      const x = Math.cos(angle) * adjustedRadius;
      const y = Math.sin(angle) * adjustedRadius;

      // 요소의 중심을 기준으로 위치 조정
      const offsetX = orbital.offsetWidth / 2;
      const offsetY = orbital.offsetHeight / 2;

      // 요소의 위치 변경
      orbital.style.transform = `translate(${x}px, ${y}px) translate(-${offsetX}px, -${offsetY}px)`;
    });

    // 다음 애니메이션 프레임 요청
    requestAnimationFrame(animate);
  }

  // 애니메이션 시작
  requestAnimationFrame(animate);

  // 비디오 요소 동적 생성
  const mainVideo = document.createElement('video');
  mainVideo.classList.add('main-2-1');
  mainVideo.muted = true;
  mainVideo.playsInline = true;
  mainVideo.loop = true;
  mainVideo.autoplay = true;

  // 비디오 컨테이너에 추가 (컨테이너의 선택자를 적절히 수정해주세요)
  const videoContainer = document.querySelector('.video-container-reel');
  videoContainer.appendChild(mainVideo);

  // 디바운스 함수
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // 모바일 환경 체크 함수 (화면 너비 기준)
  function isMobile() {
    return window.innerWidth <= 768;
  }

  // 디바이스에 따른 비디오 소스 설정
  function setVideoSource() {
    const videoSource = isMobile()
      ? './asset/main/afe-reel-mobile.mp4'
      : './asset/main/afe-reel-web.mp4';
    if (mainVideo.src !== videoSource) {
      mainVideo.src = videoSource;
    }
  }

  // 디바운스된 setVideoSource 함수
  const debouncedSetVideoSource = debounce(setVideoSource, 250);

  // 초기 비디오 소스 설정
  setVideoSource();

  // 화면 크기 변경 시 비디오 소스 재설정 (디바운스 적용)
  window.addEventListener('resize', debouncedSetVideoSource);

  // 최소 1초 대기를 위한 Promise
  const minWait = () =>
    new Promise((resolve) => setTimeout(resolve, 1000));

  // 비디오 로딩 완료를 위한 Promise
  const videoLoad = () =>
    new Promise((resolve) => {
      if (mainVideo.readyState >= 3) {
        resolve();
      } else {
        mainVideo.addEventListener('canplay', resolve);
      }
    });

  // 비디오 자동 재생 및 사용자 상호작용 처리 함수
  // 사용자 상호작용 처리 함수
  const handleUserInteraction = async () => {
    // 비디오 요소가 존재하고 일시정지 상태인 경우에만 실행
    if (mainVideo && mainVideo.paused) {
      try {
        // 비디오 재생 시도
        await mainVideo.play();
      } catch (error) {
        // 재생 실패 시 오류 로그 출력
        console.error('Video playback failed:', error);
      }
    }
  };

  // 클릭 이벤트에 대한 사용자 상호작용 처리
  document.body.addEventListener('click', handleUserInteraction);
  // 터치 이벤트에 대한 사용자 상호작용 처리 (모바일 기기 대응)
  document.body.addEventListener('touchstart', handleUserInteraction);

  try {
    // 최소 대기 시간 적용
    await minWait();

    // 로딩 페이지를 숨김 (비디오 로딩과 관계없이)
    loadingPage.classList.add('hidden');
    // no-scroll 클래스 제거하여 스크롤 허용
    body.classList.remove('no-scroll');

    // 비디오 로딩 완료 대기
    await videoLoad();

    // 비디오 재생 시도
    try {
      await mainVideo.play(); // 비디오 재생 시작
    } catch (error) {
      console.log('자동 재생 실패, 사용자 상호작용 대기:', error);
      // 자동 재생 실패 시 사용자 상호작용 대기
    }
  } catch (error) {
    console.error('Error during loading:', error);
    // 에러 발생 시에도 로딩 페이지를 숨기고 스크롤을 허용
    loadingPage.classList.add('hidden');
    body.classList.remove('no-scroll');
  }
});
</script>