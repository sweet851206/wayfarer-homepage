# plan.md - Wayfarer 대문(home) 수정 계획

## 요청 정리
1. 상단 가로 메뉴(홈/여행/수리·상담/토끼일상/소개)를 좌측 세로로 변경
2. 배경·색은 유지 + JS로 움직이는 물결(또는 움직이는 도형)을 대문에 추가해 생동감 부여

> 구현 전 승인 게이트: 사용자가 이 파일에 주석 메모 후 `코딩 시작`이라고 말하기 전까지 `index_modified.html`을 수정하지 않음.

## 1) 접근 방식 (왜 이렇게 설계했는지)
- 좌측 세로: 기존 헤더 HTML은 그대로 두고 CSS만으로 `fixed left sidebar`로 바꿈. HTML 구조를 바꾸면 JS(`showView`, `menuBtn`)가 깨질 위험이 있어서 가장 안전한 방법.
  - PC(761px 이상): 헤더를 왼쪽 `width:220px, height:100vh` 고정, `.nav`를 세로 배치. 본문(`header` 이후 형제)은 `margin-left:220px`로 밀어서 가림 방지.
  - 모바일(760px 이하): 기존 방식(상단바 + 햄버거) 그대로 유지. 폰에서 사이드바 상시는 화면을 너무 잡아먹어서 제외.
- 물결: 가벼운 SVG 물결 2겹을 대문 하단에 추가 + CSS 애니로 좌우로 흐름. JS는 `requestAnimationFrame` 대신 CSS만 사용 (성능 좋고, 기존 `float/pulse` 패턴과 일치). Canvas 파도보다 단순해서 초보자 유지보수에 유리.
  - 기존 `.orb` 2개는 유지 (삭제 금지 규칙 준수), 물결은 그 위에 얹는 레이어.

## 2) 단계별 체크리스트
- [x] 1단계: PC용 좌측 사이드바 CSS 추가 (`@media min-width:761px` 블록)
- [x] 2단계: 본문 밀기 + hero 높이 조정 (`margin-left`, `min-height` 수정이 아닌 덮어쓰기)
- [x] 3단계: 대문 물결 HTML(SVG 2겹) + CSS 파도 애니 추가
- [x] 4단계: `prefers-reduced-motion`에 물결 애니 끄기 추가
- [x] 5단계: PC(Chrome 1280px) + 모바일(390px)目视 확인 + 다크모드 확인
- [x] 리뷰어 지적 반영: 테마버튼 늘어남 수정 + 물결 2880 2회반복으로 끊김 수정

## 2차 수정 (10-18 피드백, 로컬 코더担当)
- [x] 6단계: 좌측바 메뉴 치우침 수정 (홈~소개가 밑으로 밀림 → 위로 정렬)
  - 원인: .nav justify-content:space-between이 세로모드에서 로고 위·메뉴 아래로 밂 → 사이드바 미디어쿼리에서 flex-start 덮어쓰기
- [x] 7단계: 여행 오류+흰배경 수정 (깨진 테스트글·없는 첨부·없는 2.jpg → 정리 + 도시/비대칭 CSS 배경)
  - 원인: save\posts.json에 글자깨진 테스트글 1건 + 첨부폴더(save\4e4c…​) 없음 + 2.jpg·3.jpg 파일 없음. posts.json을 []로 비우기 (테스트 잔재). travel 배경만 CSS 그라데이션으로 교체, repair(3.jpg)는 범위외
- [x] 8단계: 전체 폰트·색감·그라데이션 개선 (하늘민트 유지)
- 전환 절차: Strata(taskkill /F python serve) OFF → ollama serve ON (11434 확인, qwen3-coder:30b 정상 10-18 확인됨) → local-coder dispatch → 완료 후 Ollama 정지 → run-iq3_s.bat 기동 (8080 /v1/models 200까지 약 1~3분 대기)

- [x] 9단계: 대문 첫 진입 시 전체 내용 JS로 아래→위 상승 (Web Animations API, `#home .container` 블록 1회, 좌측 바 제외, reduced-motion 준수) — 10-18 사용자 직접 요청으로 게이트 생략 실행
- [x] 10단계: 대문 제목 전체 삭제 → 'AI 세상을 바꾸는 찬란한 열쇠'로 교체 (Gasoek One Google Fonts + 그라데이션), 아래 작은 부가 문구 '작은 시작이 큰 변화를 연다' (Nanum Myeongjo) — 브라우저 렌더 검증 완료, 신비 전달

## 3) 코드 스니펫 (실제 변경 모습)

### 3-1. 좌측 세로 사이드바 (기존 CSS 뒤에 추가, 기존 줄은 안 지움)
```css
/* 변경 전: header가 상단 가로바 */
header { position: sticky; top: 0; }

/* 변경 후: PC에서만 좌측 고정 세로바 (기존 아래에 추가) */
@media (min-width: 761px) {
  header {
    position: fixed; left: 0; top: 0; bottom: 0;
    width: 220px; border-bottom: none;
    border-right: 1px solid var(--border);
  }
  header .container.nav {
    flex-direction: column; align-items: stretch;
    height: 100vh; padding: 28px 20px; gap: 28px;
  }
  .nav-right { flex-direction: column; align-items: stretch; }
  .nav-links { flex-direction: column; align-items: stretch; gap: 6px; }
  .nav-links a { display: block; padding: 12px 14px; border-radius: 12px; }
  .nav-links a:hover, .nav-links a.active { background: var(--surface-soft); }
  .nav-links a::after { display: none; } /* 가로바 밑줄은 세로에서 제거 */
  body { padding-left: 220px; } /* 본문 가림 방지 */
  .hero { min-height: 100vh; } /* 기존 calc(100vh-68px) 덮어쓰기 */
}
```

### 3-2. 대문 물결 (section#home 안에 추가)
```html
<!-- 변경 전 -->
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="overlay"></div>

<!-- 변경 후 (orb/overlay 유지, wave만 추가) -->
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="overlay"></div>
<div class="wave-wrap" aria-hidden="true">
  <svg class="wave wave-1" viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0,64 C240,96 480,32 720,56 C960,80 1200,96 1440,64 L1440,120 L0,120 Z"/></svg>
  <svg class="wave wave-2" viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0,72 C260,40 520,100 780,72 C1040,44 1240,80 1440,60 L1440,120 L0,120 Z"/></svg>
</div>
```
```css
/* 물결 CSS (hero 안에 배치) */
.wave-wrap { position: absolute; left: 0; right: 0; bottom: -2px; height: 120px; z-index: 1; overflow: hidden; pointer-events: none; }
.wave { position: absolute; bottom: 0; width: 200%; height: 100%; }
.wave-1 { fill: rgba(14,165,233,.14); animation: waveMove 9s linear infinite; }
.wave-2 { fill: rgba(16,185,129,.12); animation: waveMove 14s linear infinite reverse; }
@keyframes waveMove { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .wave { animation: none !important; } }
```

## 4) 수정될 파일 경로
- 수정: `C:\Users\HONG\Desktop\Wayfarer_no_PHP_no_Python\index_modified.html` (CSS 블록 1곳 추가 + home 섹션에 wave HTML 1곳 + wave CSS 1곳)
- 신규: `research.md` (완료), `plan.md` (본 파일)
- 삭제: 없음 (`.bak`, 서버 파일 건드리지 않음)

## 5) 고려사항 / 트레이드오프
- 성능: SVG+CSS 애니라 CPU 부담 적음. Canvas 파도보다 단순하지만 유지보수 쉬움
- 엣지: 모바일은 사이드바 적용 제외 (화면 협소). 다크모드에서도 물결 색 그대로 사용 가능 (반투명이라 양쪽 어울림)
- 보안: 외부 라이브러리 없음, XSS 위험 없음
- 유지보수: 기존 HTML/JS 구조 변경 없음 → travel/repair/bunny 기능에 영향 없음
- 한계: `#about` 섹션 없음 문제는 이번 범위 외 (별도 작업 필요)
- <!-- 피드백 예시: 이 줄 아래에 `<!-- 메모: ... -->`로 적어주세요 -->
