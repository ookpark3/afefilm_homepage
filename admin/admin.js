// 로그인 상태 확인
function checkAuth() {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = 'login.html';
  }
}

// 로그아웃
function logout() {
  localStorage.removeItem('adminToken');
  window.location.href = 'login.html';
}

// 이미지 미리보기
function handleImagePreview(input) {
  const preview = document.getElementById('imagePreview');
  const file = input.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px;">`;
    };
    reader.readAsDataURL(file);
  }
}

// 프로젝트 목록 로드
async function loadProjects() {
  try {
    const response = await fetch('../public/crud.php?action=read');
    const projects = await response.json();

    const tbody = document.querySelector('#projectsTable tbody');
    tbody.innerHTML = '';

    projects.forEach((project) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
                <td><img src="${project.image}" alt="${project.title}" style="width: 50px;"></td>
                <td>${project.title}</td>
                <td>${project.category}</td>
                <td>${project.score}</td>
                <td>
                    <button onclick="editProject(${project.id})" class="edit-btn">수정</button>
                    <button onclick="deleteProject(${project.id})" class="delete-btn">삭제</button>
                </td>
            `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error:', error);
    alert('프로젝트 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', function () {
  checkAuth();
  loadProjects();

  // 이미지 미리보기
  document.getElementById('image').addEventListener('change', function () {
    handleImagePreview(this);
  });

  // 프로젝트 등록
  document
    .getElementById('projectForm')
    .addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(this);

      try {
        const response = await fetch('../public/crud.php?action=create', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.error) {
          alert('Error: ' + result.error);
        } else {
          alert('프로젝트가 성공적으로 등록되었습니다.');
          this.reset();
          document.getElementById('imagePreview').innerHTML = '';
          loadProjects();
        }
      } catch (error) {
        console.error('Error:', error);
        alert('프로젝트 등록 중 오류가 발생했습니다.');
      }
    });
});
