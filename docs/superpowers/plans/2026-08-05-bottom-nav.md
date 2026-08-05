# 하단 내비게이션 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여행 화면의 세로로 긴 아코디언 더미를 하단 내비게이션 다섯 탭(일정·숙소·준비물·경비·정보)으로 정리한다.

**Architecture:** 순수 함수(해시 파싱)를 먼저 깔고 → 탭별 렌더 함수를 만들고 → 라우터에 붙여 탭을 살리고 → 그다음에야 내장 섹션을 데이터에서 걷어낸다. 이 순서라야 각 태스크 끝에서 앱이 동작한다. 3번 태스크가 끝나면 탭과 기존 아코디언이 잠깐 같이 보이는데(내용 중복), 4번에서 아코디언이 사라진다.

**Tech Stack:** 바닐라 JS(기존 스타일), localStorage, `location.hash` 라우터, Python(bundle.py).

## Global Constraints

- 작업 디렉터리 `C:\Pcall\Trip`. `main`이 아닌 새 브랜치에서 작업한다.
- 빌드 도구·프레임워크·npm 의존성 없음. `<script>` 여러 개 + 전역 함수.
- 코드 스타일은 기존 파일을 따른다 — `function` 선언, `var`/`const` 혼용, 문자열 연결로 HTML 생성. 화살표 함수·클래스·ES 모듈 금지.
- 스크립트 로드 순서: `sample-trip.js` → `store.js` → `schema.js` → `views.js` → `editor.js` → `app.js`. `index.html`·`test.html`·`test-node.js` 세 곳 모두 유지.
- `test-node.js`는 `files` 배열을 **최상위 `for` 루프**로 eval한다. `forEach`로 바꾸지 말 것 — 콜백 안의 직접 `eval`은 선언을 콜백 스코프에 가둔다.
- 테스트는 `node test-node.js`(정본, 실패 시 exit 1)와 `test.html`(브라우저, 개수 일치). **현재 263개 통과.**
- 이스케이프 규율: `innerHTML`에 닿는 문자열은 `escHtml`, 숫자는 `Number()` 강제변환. 여러 줄 텍스트는 `itemLinesHtml`.
- `saveTrip`/`saveTripBody`/`lsSet`는 성공 여부 boolean을 돌려준다. **버리지 말 것** — 1단계에서 이것 때문에 두 번 되돌렸다.
- 렌더 범위 규율: 화면 전체를 다시 그리면 열어둔 것이 닫히고 입력 중이던 값이 날아간다. 탭 전환은 본문과 내비만, 일차 전환은 일차 스트립과 타임라인만 다시 그린다.
- 통화는 여전히 JPY 고정(`¥`·`jpyToKrw`·`spendFx`), 날씨는 오사카 좌표 고정. 2단계 몫이므로 건드리지 않는다.
- 커밋: `git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" commit -m "..."`, 한국어 메시지, `feat:`/`fix:`/`refactor:`/`test:`/`docs:`/`chore:` 접두사.
- 각 태스크 끝에서 `python -m http.server 8123`으로 확인한다. **8000번 금지** — 옛 서비스워커가 예전 스크립트를 서빙한 전력이 있다.

---

## 탭 정의 (전 태스크 공통)

```js
var TAB_DEFS = [
  { key: "day",     icon: "🗓", label: "일정" },
  { key: "hotel",   icon: "🏨", label: "숙소" },
  { key: "packing", icon: "🎒", label: "준비물" },
  { key: "money",   icon: "💰", label: "경비" },
  { key: "info",    icon: "ℹ️", label: "정보" }
];
```

| 해시 | 화면 |
|---|---|
| `#/t/<id>` | 일정 탭, 오늘(또는 첫/마지막) 일차 |
| `#/t/<id>/d/<n>` | 일정 탭, n일차 |
| `#/t/<id>/hotel` `/packing` `/money` `/info` | 해당 탭 |
| `#/t/<id>/edit` | 여행 설정 (탭 아님, 기존 그대로) |

---

### Task 1: 해시 파싱 순수 함수

**Files:**
- Modify: `C:\Pcall\Trip\app.js` (`route` 함수 바로 앞에 삽입)
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `TAB_DEFS: Array<{key,icon,label}>`
  - `TAB_KEYS: string[]` — `["day","hotel","packing","money","info"]`
  - `parseTripHash(hash: string): {id, tab, dayN}|null` — 여행 화면 해시가 아니면 `null`
  - `tabHash(id: string, tab: string, dayN?: number): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- 하단 내비: 해시 파싱 ----
eq('탭 키 목록', TAB_KEYS, ['day', 'hotel', 'packing', 'money', 'info']);
eq('탭 정의 개수', TAB_DEFS.length, 5);

eq('여행 루트는 일정 탭', parseTripHash('#/t/t_a'), { id: 't_a', tab: 'day', dayN: null });
eq('일차 지정', parseTripHash('#/t/t_a/d/3'), { id: 't_a', tab: 'day', dayN: 3 });
eq('숙소 탭', parseTripHash('#/t/t_a/hotel'), { id: 't_a', tab: 'hotel', dayN: null });
eq('준비물 탭', parseTripHash('#/t/t_a/packing'), { id: 't_a', tab: 'packing', dayN: null });
eq('경비 탭', parseTripHash('#/t/t_a/money'), { id: 't_a', tab: 'money', dayN: null });
eq('정보 탭', parseTripHash('#/t/t_a/info'), { id: 't_a', tab: 'info', dayN: null });

// edit은 탭이 아니다 — 라우터가 따로 처리하므로 여기서 걸리면 안 된다
eq('편집 화면은 탭으로 안 잡힘', parseTripHash('#/t/t_a/edit'), null);
eq('목록은 null', parseTripHash('#/'), null);
eq('빈 해시는 null', parseTripHash(''), null);
eq('새 여행은 null', parseTripHash('#/new'), null);
eq('모르는 탭은 null', parseTripHash('#/t/t_a/zzz'), null);
eq('꼬리가 더 붙으면 null', parseTripHash('#/t/t_a/money/x'), null);
eq('일차가 숫자 아니면 null', parseTripHash('#/t/t_a/d/abc'), null);

eq('해시 생성 일정', tabHash('t_a', 'day'), '#/t/t_a');
eq('해시 생성 일차', tabHash('t_a', 'day', 3), '#/t/t_a/d/3');
eq('해시 생성 경비', tabHash('t_a', 'money'), '#/t/t_a/money');
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: TAB_KEYS is not defined`

- [ ] **Step 3: 구현**

`app.js`의 `function route()` 바로 앞에 삽입:

```js
var TAB_DEFS = [
  { key: "day",     icon: "🗓", label: "일정" },
  { key: "hotel",   icon: "🏨", label: "숙소" },
  { key: "packing", icon: "🎒", label: "준비물" },
  { key: "money",   icon: "💰", label: "경비" },
  { key: "info",    icon: "ℹ️", label: "정보" }
];
var TAB_KEYS = TAB_DEFS.map(function (t) { return t.key; });

// 여행 화면 해시를 {id, tab, dayN}으로. 여행 화면이 아니면 null.
// /edit은 일부러 안 잡는다 — 라우터가 별도 분기로 처리한다.
function parseTripHash(hash) {
  var m = String(hash || "").match(
    /^#\/t\/([^/]+)(?:\/(?:d\/(\d+)|(hotel|packing|money|info)))?$/);
  if (!m) return null;
  if (m[2]) return { id: m[1], tab: "day", dayN: parseInt(m[2], 10) };
  return { id: m[1], tab: m[3] || "day", dayN: null };
}

function tabHash(id, tab, dayN) {
  if (tab !== "day") return '#/t/' + id + '/' + tab;
  return dayN ? '#/t/' + id + '/d/' + dayN : '#/t/' + id;
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0. 263 + 18 = 281개 통과.

`route()`는 아직 이 함수를 쓰지 않는다 — 앱 동작은 변하지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add app.js tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 탭 해시 파싱 순수 함수 추가"
```

---

### Task 2: 탭별 패널 렌더

아직 라우터에 붙이지 않는다. 함수만 만들고 테스트한다.

**Files:**
- Modify: `C:\Pcall\Trip\views.js`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: `escHtml`, `itemLinesHtml`, `expensesTableHtml`, `sectionBodyHtml`, `renderPacking`, `renderSpend` (views.js), `TAB_DEFS` (app.js — 런타임에만 참조하므로 로드 순서 문제 없음)
- Produces:
  - `panelHtml(trip, tab): string` — 순수. 탭 본문의 HTML
  - `renderPanel(trip, st, tab): void` — `#tab-panel`에 그리고, 필요하면 `renderPacking`/`renderSpend`를 호출
  - `renderTabbar(trip, tab, onSelect): void` — `#tabbar`에 그린다

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- 하단 내비: 패널 HTML ----
var PT = {
  id: 't_p', title: '여행', start: '2026-09-01', end: '2026-09-03', party: 2,
  hotel: '빈펄 리조트\n체크인 14시',
  budgetKRW: 0, days: [], packing: [], expenses: [],
  sections: [{ id: 's1', icon: '🚄', title: '기차', type: 'list', body: ['08:00 출발'] }]
};

eq('숙소 패널은 줄바꿈을 살린다',
  panelHtml(PT, 'hotel').indexOf('<div class="line">체크인 14시</div>') >= 0, true);
eq('숙소 없으면 빈 상태',
  panelHtml({ hotel: '' }, 'hotel').indexOf('class="empty"') >= 0, true);
eq('숙소 패널 XSS',
  panelHtml({ hotel: '<img src=x onerror=alert(1)>' }, 'hotel').indexOf('<img') === -1, true);

eq('준비물 패널은 packing-body 컨테이너',
  panelHtml(PT, 'packing').indexOf('id="packing-body"') >= 0, true);

eq('경비 패널은 spend-body 컨테이너',
  panelHtml(PT, 'money').indexOf('id="spend-body"') >= 0, true);
eq('경비 내역 없으면 표를 안 그린다',
  panelHtml(PT, 'money').indexOf('<table') === -1, true);
eq('경비 내역 있으면 표를 그린다',
  panelHtml({ hotel: '', expenses: [{ date: '2026-08-01', cat: '항공', detail: '왕복', krw: 300000 }],
              sections: [] }, 'money').indexOf('<table') >= 0, true);

eq('정보 패널은 사용자 섹션을 그린다',
  panelHtml(PT, 'info').indexOf('기차') >= 0, true);
eq('정보 패널 섹션 없으면 빈 상태',
  panelHtml({ sections: [] }, 'info').indexOf('class="empty"') >= 0, true);
eq('정보 패널 섹션 제목 XSS',
  panelHtml({ sections: [{ id: 's', icon: '📌', title: '<img src=x>', type: 'list', body: [] }] },
    'info').indexOf('<img src=x>') === -1, true);

eq('일정 탭은 패널을 안 쓴다', panelHtml(PT, 'day'), '');
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: panelHtml is not defined`

- [ ] **Step 3: `views.js`에 구현**

`renderFixed` 바로 앞에 삽입:

```js
// 탭 본문. 일정 탭은 #daytabs/#timeline을 따로 쓰므로 여기서는 빈 문자열.
function panelHtml(trip, tab) {
  if (tab === "hotel") {
    return trip.hotel
      ? '<div class="panel-card">' + itemLinesHtml(trip.hotel) + '</div>'
      : '<p class="empty">숙소가 아직 없습니다. ⚙ 여행 설정에서 입력할 수 있습니다.</p>';
  }
  if (tab === "packing") {
    return '<div class="panel-card" id="packing-body"></div>';
  }
  if (tab === "money") {
    var exp = (trip.expenses && trip.expenses.length)
      ? '<div class="panel-card"><h2 class="panel-h">💰 출발 전 결제 내역</h2>' +
        expensesTableHtml(trip) + '</div>'
      : '';
    return '<div class="panel-card" id="spend-body"></div>' + exp;
  }
  if (tab === "info") {
    var secs = trip.sections || [];
    if (!secs.length) {
      // 섹션 편집기는 2단계다 — 지금 할 수 있는 게 없으므로 없는 기능을 가리키지 않는다.
      return '<p class="empty">시간표·메모처럼 직접 만드는 항목이 여기 표시됩니다.</p>';
    }
    return secs.map(function (sec, i) {
      return '<details' + (i === 0 ? ' open' : '') + '>' +
        '<summary>' + escHtml(sec.icon) + ' ' + escHtml(sec.title) + '</summary>' +
        '<div class="acc">' + sectionBodyHtml(trip, sec) + '</div></details>';
    }).join('');
  }
  return '';
}

function renderPanel(trip, st, tab) {
  var el = document.getElementById("tab-panel");
  if (!el) return;
  el.innerHTML = panelHtml(trip, tab);
  if (tab === "packing") renderPacking(trip, st);
  if (tab === "money") renderSpend(trip, st);
}

function renderTabbar(trip, tab, onSelect) {
  var nav = document.getElementById("tabbar");
  if (!nav) return;
  nav.innerHTML = TAB_DEFS.map(function (t) {
    var on = t.key === tab ? ' data-selected="1"' : '';
    return '<button class="tb"' + on + ' data-tab="' + escHtml(t.key) + '"' +
      ' aria-current="' + (t.key === tab ? 'page' : 'false') + '">' +
      '<span class="tb-i">' + t.icon + '</span>' +
      '<span class="tb-l">' + escHtml(t.label) + '</span></button>';
  }).join('');
  nav.querySelectorAll('.tb').forEach(function (b) {
    b.addEventListener('click', function () { onSelect(b.dataset.tab); });
  });
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0.

- [ ] **Step 5: 커밋**

```bash
git add views.js tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 탭별 패널 렌더와 하단 내비 렌더 함수 추가"
```

---

### Task 3: 마크업·스타일·라우터 연결 — 탭이 살아난다

이 태스크가 끝나면 탭이 동작한다. 기존 아코디언(`#fixed`)은 아직 남아 있어 숙소·준비물·경비가 두 군데 보인다 — Task 4에서 정리한다.

**Files:**
- Modify: `C:\Pcall\Trip\index.html`
- Modify: `C:\Pcall\Trip\styles.css`
- Modify: `C:\Pcall\Trip\app.js`
- Modify: `C:\Pcall\Trip\views.js` (`renderSummary`의 편집 토글 노출 조건)

**Interfaces:**
- Consumes: `parseTripHash`, `tabHash`, `TAB_DEFS` (Task 1), `renderPanel`, `renderTabbar` (Task 2)
- Produces:
  - `CUR.tab: string` — 현재 탭
  - `showTrip(id, tab, dayN)` — 인자가 셋으로 바뀐다
  - `showPanelTab(trip, tab, dayN)` — 탭 전환 시 본문·내비만 다시 그린다. `tab === "day"`면 `dayN`을 `showDay`로 넘긴다

- [ ] **Step 1: `index.html` 구조 변경**

`#screen-trip`을 다음으로 교체:

```html
  <section id="screen-trip" hidden>
    <header id="summary"></header>
    <div id="tab-day">
      <nav id="daytabs"></nav>
      <main id="timeline"></main>
    </div>
    <div id="tab-panel"></div>
    <nav id="tabbar"></nav>
  </section>
```

- [ ] **Step 2: `styles.css`에 탭바 추가**

파일 끝에 추가:

```css
#tabbar { position:fixed; left:0; right:0; bottom:0; z-index:10;
  display:flex; background:var(--card); border-top:1px solid #dde4e8;
  padding-bottom:env(safe-area-inset-bottom); }
#tabbar .tb { flex:1; border:0; background:none; font:inherit; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:2px;
  padding:8px 2px 6px; color:var(--muted); }
#tabbar .tb[data-selected] { color:var(--accent); font-weight:700; }
#tabbar .tb-i { font-size:1.15rem; line-height:1.1; }
#tabbar .tb-l { font-size:.7rem; }
/* 하단 고정 바에 마지막 항목이 가리지 않도록 본문에 여백을 준다. */
#screen-trip { padding-bottom:calc(64px + env(safe-area-inset-bottom)); }
#tab-panel { padding:12px; }
.panel-card { background:var(--card); border-radius:14px; padding:14px 16px;
  margin-bottom:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
.panel-h { margin:0 0 8px; font-size:.9rem; color:var(--accent); }
#tab-panel .empty { color:var(--muted); text-align:center; padding:32px 16px; }
#tab-panel details { background:var(--card); border-radius:14px; margin-bottom:10px;
  box-shadow:0 1px 4px rgba(0,0,0,.06); overflow:hidden; }
#tab-panel summary { padding:14px 16px; font-weight:700; cursor:pointer; }
```

- [ ] **Step 3: `app.js` 라우터·`showTrip` 수정**

`CUR` 선언에 `tab`을 추가:

```js
var CUR = { id: null, trip: null, st: null, dayN: null, tab: "day" };
```

`showTrip`을 다음으로 교체 (기존 주석은 그대로 살린다):

```js
function showTrip(id, tab, dayN) {
  var switched = (CUR.id !== id);
  var opening = switched || document.getElementById("screen-trip").hidden;
  var trip = opening ? loadTrip(id) : CUR.trip;
  if (!trip) { go('#/'); return; }

  CUR.id = id; CUR.trip = trip; CUR.st = tripStore(id);
  if (switched) { wxReset(); EDIT_MODE = false; }
  showScreen("trip");

  if (opening) renderSummary(trip, CUR.st);
  showPanelTab(trip, tab || "day", dayN);
  if (opening) {
    renderFixed(trip, CUR.st);
    wxRefresh(CUR.st);
  }
}

// 탭 전환: 본문과 내비만 다시 그린다. 요약 헤더는 건드리지 않는다 —
// 전체를 다시 그리면 열어둔 것이 닫히고 입력 중이던 값이 날아간다.
function showPanelTab(trip, tab, dayN) {
  var prev = CUR.tab;
  CUR.tab = tab;
  document.getElementById("tab-day").hidden = (tab !== "day");
  document.getElementById("tab-panel").hidden = (tab === "day");
  if (tab === "day") showDay(trip, dayN);
  else renderPanel(trip, CUR.st, tab);
  renderTabbar(trip, tab, function (t) { go(tabHash(trip.id, t, CUR.dayN)); });
  // 편집 토글은 일정 탭에서만 의미가 있다.
  if (prev !== tab) renderSummary(trip, CUR.st);
}
```

`route()`를 다음으로 교체:

```js
function route() {
  var h = location.hash || "#/";
  var t = parseTripHash(h);
  if (t) { showTrip(t.id, t.tab, t.dayN); return; }
  if (/^#\/t\/[^/]+\/edit$/.test(h)) { showEdit(h.split('/')[2]); return; }
  if (h === "#/new") { showEdit(null); return; }
  showList();
}
```

`repaintDay`와 그 외 `showTrip(` 호출부를 모두 새 서명에 맞춘다. `grep -n "showTrip(" *.js`로 빠짐없이 확인할 것.

- [ ] **Step 4: `views.js` — 편집 토글을 일정 탭에서만**

`renderSummary`가 만드는 `.edit-mode` 버튼 문자열을 조건부로 바꾼다. 현재는 무조건 내보내고 있다:

```js
// 전
'<button class="edit-mode" type="button" aria-pressed="' + (EDIT_MODE ? 'true' : 'false') +
  '">' + (EDIT_MODE ? '완료' : '편집') + '</button>' +

// 후 — CUR은 app.js에 있고 런타임에만 참조되므로 로드 순서 문제는 없다.
// 앱 화면이 없는 test.html에서는 CUR이 없을 수 있으므로 typeof로 막는다.
((typeof CUR !== 'undefined' && CUR.tab !== 'day')
  ? ''
  : '<button class="edit-mode" type="button" aria-pressed="' + (EDIT_MODE ? 'true' : 'false') +
    '">' + (EDIT_MODE ? '완료' : '편집') + '</button>') +
```

버튼이 없을 때 핸들러를 붙이는 코드는 이미 `if (mb)` 가드가 있으므로 그대로 둔다. `⚙` 버튼은 손대지 않는다.

- [ ] **Step 5: 브라우저 확인**

```bash
cd /c/Pcall/Trip && python -m http.server 8123
```

`http://localhost:8123/`에서 확인:
1. 샘플 여행을 열면 하단에 탭 다섯 개, 일정이 선택됨
2. 탭을 누르면 본문이 바뀌고 URL이 `#/t/…/money` 식으로 바뀜
3. 뒤로가기로 이전 탭으로 돌아감
4. 경비 탭에서 금액을 입력하고 추가 → 목록에 뜨고, 상단 요약 합계도 갱신
5. 일정 탭에서만 `편집` 버튼이 보이고, 다른 탭에서는 사라짐
6. 일차 탭 전환이 1단계와 동일하게 동작
7. 창을 좁혀도(폰 폭) 탭바가 가로로 다섯 칸 유지

- [ ] **Step 6: 커밋**

```bash
git add index.html styles.css app.js views.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 하단 내비게이션 탭 다섯 개와 탭 라우팅"
```

---

### Task 4: 내장 섹션을 데이터에서 제거

**Files:**
- Modify: `C:\Pcall\Trip\schema.js` (`defaultSections`)
- Modify: `C:\Pcall\Trip\store.js` (마이그레이션 추가)
- Modify: `C:\Pcall\Trip\sample-trip.js` (builtin 4개 제거)
- Modify: `C:\Pcall\Trip\views.js` (`renderFixed`·`sectionBodyHtml`의 builtin 분기 제거)
- Modify: `C:\Pcall\Trip\app.js` (`renderFixed` 호출 제거)
- Modify: `C:\Pcall\Trip\index.html` (`#fixed` 제거)
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: `listTrips`, `loadTrip`, `saveTripBody` (store.js)
- Produces:
  - `stripBuiltinSections(sections): Array` — 순수. `type === "builtin"`을 걸러낸다
  - `migrateSections(): number` — 여행별로 적용하고 바뀐 여행 수를 반환. 재실행해도 안전

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- 내장 섹션 제거 ----
eq('builtin만 걸러낸다', stripBuiltinSections([
  { id: 'a', type: 'table' }, { id: 'b', type: 'builtin', body: 'hotel' },
  { id: 'c', type: 'list' },  { id: 'd', type: 'builtin', body: 'spend' }
]).map(function (s) { return s.id; }), ['a', 'c']);
eq('builtin이 없으면 그대로', stripBuiltinSections([{ id: 'a', type: 'list' }]).length, 1);
eq('빈 배열도 안전', stripBuiltinSections([]), []);
eq('배열이 아니면 빈 배열', stripBuiltinSections(null), []);

eq('새 여행은 섹션이 비어 있다', defaultSections(), []);

(function () {
  __resetStorage();
  var t = emptyTrip({ title: '테스트', start: '2026-09-01', end: '2026-09-02' });
  t.sections = [
    { id: 'u1', icon: '🚄', title: '기차', type: 'list', body: ['a'] },
    { id: 'b1', icon: '🏨', title: '숙소', type: 'builtin', body: 'hotel' }
  ];
  saveTrip(t);
  eq('마이그레이션이 한 여행을 고침', migrateSections(), 1);
  eq('builtin이 사라짐', loadTrip(t.id).sections.map(function (s) { return s.id; }), ['u1']);
  eq('두 번째 실행은 0건', migrateSections(), 0);
})();

eq('샘플 여행에 builtin 섹션 없음',
  window.SAMPLE_TRIP.sections.filter(function (s) { return s.type === 'builtin'; }).length, 0);
eq('샘플 여행의 사용자 섹션은 둘',
  window.SAMPLE_TRIP.sections.map(function (s) { return s.title; }),
  ['라피트 시간표', '팁']);
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: stripBuiltinSections is not defined`

- [ ] **Step 3: `schema.js` — `defaultSections`를 빈 배열로**

```js
// 내장 항목(숙소·준비물·경비)은 하단 탭이 됐다. sections는 사용자가 만든 것만 담는다.
function defaultSections() {
  return [];
}
```

- [ ] **Step 4: `store.js`에 마이그레이션 추가**

`migrateMealKeys` 옆에 추가:

```js
function stripBuiltinSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.filter(function (s) { return !s || s.type !== "builtin"; });
}

// 내장 섹션은 하단 탭이 됐으므로 데이터에서 걷어낸다. 재실행해도 안전하다
// (걸러낼 게 없으면 길이가 같아 쓰기를 건너뛴다).
function migrateSections() {
  var changed = 0;
  listTrips().forEach(function (row) {
    var trip = loadTrip(row.id);
    if (!trip) return;
    var next = stripBuiltinSections(trip.sections);
    if (next.length === (trip.sections || []).length) return;
    trip.sections = next;
    if (saveTripBody(trip)) changed++;
  });
  return changed;
}
```

`app.js`의 `DOMContentLoaded` 안, `migrateMealKeys()` 다음 줄에 `migrateSections();`를 추가한다.

- [ ] **Step 5: `sample-trip.js`에서 builtin 4개 제거**

`sections` 배열에서 `"type": "builtin"`인 항목 넷(`s_hotel`, `s_packing`, `s_spend`, `s_expenses`)을 지운다. `s_rapit`과 `s_tips`만 남긴다.

`convert_sample.py`는 `data.js`가 삭제돼 더 이상 실행할 수 없다 — 파일을 직접 편집하고, 스크립트의 provenance 주석에 이 변경을 한 줄 덧붙인다.

- [ ] **Step 6: `views.js`·`app.js`·`index.html`에서 아코디언 제거**

- `renderFixed` 함수를 삭제한다. `app.js`의 `renderFixed(trip, CUR.st);` 호출도 삭제한다.
- `sectionBodyHtml`에서 `if (sec.type === "builtin") { … }` 블록을 삭제한다. `text`/`list`/`table` 세 분기만 남는다.
- `index.html`의 `<section id="fixed"></section>`를 삭제한다.
- `renderPacking`/`renderSpend`는 그대로 둔다 — `#packing-body`/`#spend-body`를 이제 `renderPanel`이 만든다.

`grep -n "renderFixed\|#fixed\|getElementById(\"fixed\")" *.js *.html`로 잔재가 없는지 확인한다.

- [ ] **Step 7: 통과 확인과 브라우저 확인**

```bash
cd /c/Pcall/Trip && node test-node.js && python -m http.server 8123
```

DevTools 콘솔에서 `localStorage.clear()` 후:
1. 샘플 여행 → 정보 탭에 라피트 시간표와 팁만, 숙소·준비물·경비는 각 탭에
2. 타임라인 아래에 아코디언 더미가 없음
3. 새 여행 → 정보 탭이 빈 상태 안내를 보여줌
4. 마이그레이션: 콘솔에서 구 형식 여행을 심고 새로고침
   ```js
   var t = loadTrip(listTrips()[0].id);
   t.sections.push({ id:'b9', icon:'🏨', title:'숙소', type:'builtin', body:'hotel' });
   saveTripBody(t); location.reload();
   ```
   → 정보 탭에 "숙소" 아코디언이 나타나지 않고, `loadTrip(...).sections`에서 사라짐

- [ ] **Step 8: 커밋**

```bash
git add schema.js store.js sample-trip.js views.js app.js index.html tests.js convert_sample.py
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "refactor: 내장 섹션을 데이터에서 제거하고 하단 탭으로 대체"
```

---

### Task 5: 서비스워커·번들러·회귀

**Files:**
- Modify: `C:\Pcall\Trip\sw.js`
- Modify: `C:\Pcall\Trip\bundle.py`
- Modify: `C:\Pcall\Trip\docs\superpowers\specs\2026-08-05-bottom-nav-design.md` (구현 중 달라진 결정이 있으면)

- [ ] **Step 1: `sw.js` 캐시 버전**

`const CACHE = "trip-v8";` → `"trip-v9";`. `ASSETS` 목록은 파일이 늘거나 줄지 않았으므로 그대로다.

- [ ] **Step 2: `bundle.py`의 `<body>` 구조를 `index.html`과 맞춤**

`bundle.py`가 인라인하는 `<body>`는 `index.html`을 손으로 옮겨 적은 것이다. Task 3·4에서 `#screen-trip` 구조가 바뀌고 `#fixed`가 사라졌으므로 그대로 반영한다. **`index.html`의 실제 내용을 읽어서 복사할 것** — 기억에 의존하지 말 것.

```bash
cd /c/Pcall/Trip && python bundle.py && node -e "
var h = require('fs').readFileSync('trip.html','utf8');
['tab-day','tab-panel','tabbar','screen-list','screen-edit'].forEach(function(id){
  console.log((h.indexOf('id=\"'+id+'\"')>=0?'OK  ':'MISS'), id);
});
console.log('fixed 잔재:', h.indexOf('id=\"fixed\"')>=0);
console.log('scripts:', h.split('<script>').length-1, '| size:', h.length);
"
```
Expected: 다섯 개 모두 OK, `fixed 잔재: false`, `scripts: 6`

- [ ] **Step 3: 회귀 확인**

`python -m http.server 8123` (8000 금지). 각 항목에서 본 것을 보고한다.

1. **오사카 회귀** — 샘플 여행: 요약 헤더(D-day·기간·숙소·총액·날씨), 일정 탭의 일차 7개와 ⏰ 배지, 숙소 탭, 준비물 탭 15개, 경비 탭의 현지 경비 + 경비 내역 합계 2,612,367, 정보 탭의 라피트 표 2개와 팁 2줄
2. **탭 이동** — 다섯 탭을 오가며 요약 헤더가 깜빡이지 않는지, 뒤로가기가 탭을 되돌리는지, URL이 탭을 반영하는지
3. **입력 보존** — 경비 탭에서 금액을 입력하고 **다른 항목을 추가**해도 입력 중이던 값이 남는지. 준비물 탭에서 체크 후 항목 추가도 같이
4. **일정 탭 회귀** — 일차 전환, 편집 토글, 항목 추가·수정·삭제, 시간순 정렬이 1단계와 동일한지
5. **새 여행** — 만들고 다섯 탭을 모두 열어 빈 상태 안내가 뜨는지, 아무 탭도 예외를 던지지 않는지
6. **오프라인** — DevTools Offline 후 재로드. 앱이 뜨고 탭 이동이 되는지
7. **XSS** — 일정에 `<img src=x onerror=alert(1)>`, 숙소에도 같은 문자열을 넣고 각 탭에서 글자 그대로 보이는지
8. **좁은 폭** — 창을 390px로 줄여 탭바가 다섯 칸을 유지하고 마지막 항목이 바에 가리지 않는지

- [ ] **Step 4: 커밋**

```bash
git add -A
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "chore: sw v9와 번들러를 하단 내비 구조에 맞춤"
```

---

## 완료 기준

- `node test-node.js` 전부 통과, `test.html`도 같은 개수
- 샘플 여행의 모든 내용이 개편 전과 동일하게, 다섯 탭에 나뉘어 보인다
- 탭 이동이 URL·뒤로가기와 일치한다
- 같은 탭 안의 동작이 입력 중이던 값을 날리지 않는다
- 새 여행에서 다섯 탭 모두 예외 없이 열리고 빈 상태를 안내한다
- `sections`에 `type:"builtin"`이 남아 있지 않다

## 2단계로 넘기는 것

- 섹션 편집기 (정보 탭에 붙는다)
- 일차별 도시·통화, 환율 조회, 이미지 첨부
- 스와이프로 탭 전환
- 탭 순서·표시 여부 사용자 설정
