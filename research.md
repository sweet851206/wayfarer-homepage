# research.md - Wayfarer 대문(home) 리서치

## 1) 관련 파일 경로 및 역할
- `index_modified.html` (58KB, 실제 홈페이지 전부): 상단 헤더 + 대문 + travel/repair/bunny 섹션 + JS 포함. 단일 파일 구조.
  - 헤더: 1224~1241줄 `header > .container.nav > .logo + .nav-right > ul#navLinks(홈/여행/수리·상담/토끼일상/소개) + themeToggle + menuBtn`
  - 헤더 CSS: 111~212줄 (`header sticky top:0`, `.nav {flex row, height:68px}`, `.nav-links {flex row gap:26px}`)
  - 모바일 메뉴 CSS: 1174~1193줄 (`max-width:760px`에서 `.nav-links` 숨김 + `.open`시 세로 드롭다운)
  - 대문: 1243~1294줄 `section#home.hero` + CSS 214~515줄 (`.hero`, `.orb-1/2 + @keyframes float`, `.hero-badge::before pulse`, `.rise` 등장 애니)
- `wayfarer_server.ps1`: 8000포트 정적+API 서버. 이번 대문 CSS/JS 작업과 무관 (건드리지 않음)
- `start_wayfarer.bat`: 서버 실행용. 건드리지 않음
- `index_modified.bak` (29KB): 구버전 백업. 건드리지 않음

## 2) 현재 동작 흐름
1. 진입: `start_wayfarer.bat` → http://127.0.0.1:8000/index_modified.html
2. 라우팅 JS (1491~1503줄): `hashchange → showView(name)` → `section[data-view]` 중 일치하는 1개만 `hidden` 해제, 나머지는 숨김. `.nav-links a`에 `active` 표시
3. 헤더: PC에서는 가로 메뉴 상시 표시, 모바일(760px 이하)에서는 ☰ 버튼 → `.nav-links.open` 토글로 세로 드롭다운
4. 대문 애니: `.orb` 2개가 `float 16s`로 둥둥 떠다님 + `.rise` 4단계 순차 등장. 그 외 움직임 없음

## 3) 기존 아키텍처 패턴 및 컨벤션
- 단일 HTML에 `<style>` + `<script>` 인라인 (빌드 없음, 외부 CSS/JS 파일 없음)
- CSS 변수 테마: `:root` + `[data-theme="dark"]` (대문 `.hero`도 라이트/다크 분기 있음)
- `prefers-reduced-motion` 지원: 511줄에서 애니 끄기 (접근성 규칙, 유지해야 함)
- 초보자 친화: 한글 주석, 단순한 구조 유지

## 4) 의존성 및 사이드 이펙트 (영향 범위)
- 헤더를 좌측 세로로 바꾸면 영향받는 곳:
  - `.container {width:min(1160px, calc(100%-40px))}` → 사이드바 공간만큼 본문이 가려지지 않게 여백 필요
  - `.hero {min-height:calc(100vh-68px)}` → 68px 헤더 전제라 수치 조정 필요
  - `section[id] {scroll-margin-top:88px}` → 상단 헤더용 여백이라 사이드바에서는 불필요 (해롭진 않음)
  - 모바일 기존 햄버거 메뉴는 그대로 유지해야 함 (안 그러면 폰에서 메뉴 접근 불가)
- `#about` 링크 주의 (미확인 사항): `href="#about"`인데 `section[data-view="about"]`이 없음. 현재도 클릭하면 화면 전환 없이 멈춤. 이번 작업에서 고치지 않음 (범위 외)
- 대문 생동감: 기존 색(하늘+민트 그라데이션) 유지 요청 → 색은 안 건드리고, 움직임 레이어만 추가. `prefers-reduced-motion`에서는 새 애니도 꺼야 함
