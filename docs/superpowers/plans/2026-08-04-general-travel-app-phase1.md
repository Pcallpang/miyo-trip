# 범용 여행앱 1단계 (데이터 모델·편집기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오사카 일정이 `data.js`에 하드코딩된 앱을, 사용자가 앱 안에서 자기 여행을 만들고 편집하는 앱으로 바꾼다. 내 오사카 여행은 샘플 여행으로 그대로 남는다.

**Architecture:** `app.js` 435줄 단일 파일을 책임별로 6개로 쪼갠다. 여행 데이터는 `window.TRIP` 전역 대신 localStorage의 Trip 객체가 되고, 렌더 함수는 `trip`을 인자로 받는다. 리팩터링 안전망(Node 테스트 러너)을 먼저 깔고, 순수 로직(저장소·스키마·변환) → 렌더 분리 → 라우터 → 편집기 순으로 진행한다.

**Tech Stack:** 바닐라 JS (ES5 스타일 `function`/`var`, 화살표 함수·클래스·모듈 금지), localStorage, IndexedDB(2단계), Python 3(bundle.py), Node(테스트 러너만).

## Global Constraints

- 작업 디렉터리 `C:\Pcall\Trip`. 브랜치는 `main`이 아닌 새 브랜치에서 작업한다.
- 빌드 도구·프레임워크·npm 의존성을 도입하지 않는다. `<script>` 여러 개 + 전역 함수 방식을 유지한다.
- 코드 스타일은 기존 `app.js`를 따른다 — `function` 선언, `var`/`const` 혼용, 문자열 연결로 HTML 생성, 화살표 함수 없음.
- 테스트는 `node test-node.js` 하나로 돌린다. 실패 시 exit code 1.
- **1단계에서는 통화를 건드리지 않는다.** `jpyToKrw`, `¥` 리터럴, `spendFx`, 경비 레코드의 `jpy` 필드를 그대로 둔다. 다통화·환율은 2단계다. 단, Trip 객체에 `currency` 필드는 미리 넣어 저장한다.
- **1단계에서는 날씨 좌표·도시 검색을 건드리지 않는다.** `WX_URL`의 오사카 좌표 고정을 유지한다. 2단계다.
- 스키마 상수 `SCHEMA = 1`.
- localStorage 키 규약:
  - `trip:index` → `[{id, title, start, end}]`
  - `trip:<id>` → Trip 전체
  - `trip:<id>:<k>` → 여행별 런타임 상태 (`spend`, `fx`, `packing_checked`, `packing_add`, `meal:<n>:<i>`, `weather`)
  - 구 키 `osaka-trip:v1:*` 는 마이그레이션 후 제거
- 커밋 명령은 항상:
  `git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" commit -m "..."`
- 커밋 메시지는 한국어, `feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:` 접두사.
- 각 태스크 끝에서 앱은 동작해야 한다. `index.html`을 로컬 서버로 열어 화면이 깨지지 않았는지 확인한다:
  `python -m http.server 8000` → `http://localhost:8000/`

---

## 파일 구성

| 파일 | 책임 | 태스크 |
|---|---|---|
| `test-node.js` | Node 테스트 러너 (스텁 + 파일 로드 + 결과 출력) | 1 |
| `tests.js` | 모든 단언. 브라우저·Node 양쪽에서 공유 | 1 |
| `test.html` | 브라우저 테스트 러너 | 1 |
| `store.js` | localStorage 래퍼, Trip CRUD, 여행별 키, 마이그레이션 | 2, 4 |
| `schema.js` | Trip 스키마 헬퍼 — 일차 생성·재동기화, 기본값, 요일 파생 | 3 |
| `sample-trip.js` | 오사카 여행 (새 스키마). `convert_sample.py`가 생성 | 4 |
| `convert_sample.py` | `data.js` → `sample-trip.js` 1회 변환 스크립트 | 4 |
| `views.js` | 렌더 — summary/tabs/timeline/fixed/spend/packing | 5 |
| `app.js` | 라우팅과 부팅만 | 6 |
| `editor.js` | 여행 만들기·설정, 일정 카드 편집 | 7, 8 |

`money.js`(통화)·`remote.js`(날씨·환율·지오코딩)·`images.js`(첨부)는 2단계에서 신설한다. 1단계에서는 날씨 코드가 `app.js`에 남는다.

## Trip 스키마 (1단계 최종형)

```js
{
  schema: 1,
  id: "t_m3k2x9",
  title: "오사카 여행",
  start: "2026-07-28", end: "2026-08-03",
  party: 2,
  place:    { name: "오사카", country: "일본", lat: 34.69, lon: 135.5, tz: "Asia/Tokyo" },
  currency: { code: "JPY", symbol: "¥", decimals: 0, unit: 100 },
  hotel: "포포인츠 …",
  budgetKRW: 2612367,
  days: [{
    n: 1, date: "2026-07-28", theme: "청주 → 오사카",
    place: null,        // null이면 trip.place 상속 (2단계에서 사용)
    curCode: null,      // null이면 trip.currency 상속 (2단계에서 사용)
    items: [{ id: "i_1", time: "08:00", text: "렛츠 고 일본! 얏호" }],
    meals: [], images: []
  }],
  sections: [
    { id: "s_1", icon: "🚄", title: "라피트 시간표", type: "table", body: [
      { caption: "간사이 → 난바", head: ["편","출발","도착"], rows: [["특급 라피트 α","13:05","13:43"]] }
    ]},
    { id: "s_2", icon: "🏨", title: "숙소",      type: "builtin", body: "hotel" },
    { id: "s_3", icon: "🎒", title: "준비물",    type: "builtin", body: "packing" },
    { id: "s_4", icon: "💸", title: "현지 경비", type: "builtin", body: "spend" },
    { id: "s_5", icon: "💰", title: "경비 내역", type: "builtin", body: "expenses" },
    { id: "s_6", icon: "💡", title: "팁",        type: "list",    body: ["5500엔 이상 …"] }
  ],
  packing: ["여권 + 사본", …],
  expenses: [{ date, cat, detail, pay, krw, note }]
}
```

**설계 요점 — `sections`가 하단 아코디언 전체를 담는다.** 내장 섹션(숙소·준비물·현지 경비·경비 내역)도 `type:"builtin"`으로 배열에 들어간다. 그래야 오사카 원본의 아코디언 순서(라피트 → 숙소 → 준비물 → 현지 경비 → 경비 내역 → 팁)를 데이터로 그대로 재현할 수 있고, 사용자가 순서를 바꾸거나 숨길 수 있다.

`dow`(요일)는 저장하지 않고 `date`에서 파생한다.

---

### Task 1: 테스트 러너 정비

리팩터링 안전망을 먼저 깐다. 지금 `test.html`은 `app.js` 하나만 로드하므로 파일이 쪼개지면 그대로 못 쓴다. 단언을 `tests.js`로 빼서 브라우저·Node 양쪽이 공유하게 한다.

**Files:**
- Create: `C:\Pcall\Trip\tests.js`
- Create: `C:\Pcall\Trip\test-node.js`
- Modify: `C:\Pcall\Trip\test.html` (단언을 tests.js로 이동, 러너만 남김)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `tests.js` — 전역 `eq(name, got, want)`를 호출하는 단언 모음. 러너가 `eq`를 먼저 정의해 둔다.
  - `node test-node.js` — 전부 통과면 exit 0, 하나라도 실패면 실패 목록 출력 후 exit 1

- [ ] **Step 1: `tests.js` 생성 — 기존 단언 그대로 이동**

`test.html`의 `<script>` 안에서 `var L = [...]`부터 `eq('wxLine 없는 날짜', …)`까지를 잘라내 `tests.js`로 옮긴다. `eq` 함수 정의와 `results`/`failed` 변수, 마지막 `document.getElementById('out')` 줄은 옮기지 않는다 (러너 몫).

`tests.js` 첫 줄에 주석을 단다:

```js
// 브라우저(test.html)와 Node(test-node.js) 양쪽에서 로드된다.
// 러너가 전역 eq(name, got, want)를 미리 정의해 둔다. 여기서는 단언만 쓴다.
```

- [ ] **Step 2: `test-node.js` 생성**

`eq`는 `tests.js`를 eval 하기 **전에** 정의돼야 한다. 순서에 주의한다.

```js
// 순수 함수 테스트를 Node에서 실행한다. 브라우저 API는 최소 스텁으로 대체.
var fs = require("fs");

var mem = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; },
  key: function (i) { return Object.keys(mem)[i]; },
  get length() { return Object.keys(mem).length; }
};
global.document = { addEventListener: function () {}, getElementById: function () { return null; } };
global.window = global;
global.__resetStorage = function () { mem = {}; };

var failed = 0, out = [];
global.eq = function (name, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { out.push("PASS " + name); return; }
  failed++;
  out.push("FAIL " + name + "\n  got : " + JSON.stringify(got) + "\n  want: " + JSON.stringify(want));
};

// 로드 순서 = index.html의 script 순서
["app.js", "tests.js"].forEach(function (f) {
  eval(fs.readFileSync(f, "utf8"));
});

console.log(out.join("\n"));
console.log(failed ? failed + "개 실패" : out.length + "개 전부 통과");
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: `test.html`을 러너로 축소**

`<body>` 안의 `<script>` 두 개를 다음으로 교체한다:

```html
<script src="app.js"></script>
<script>
var results = [], failed = 0;
function eq(name, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  results.push('<div class="' + (ok ? 'p' : 'f') + '">' + (ok ? 'PASS' : 'FAIL') + ' ' + name +
    (ok ? '' : '<br>&nbsp;&nbsp;got&nbsp;: ' + JSON.stringify(got) +
               '<br>&nbsp;&nbsp;want: ' + JSON.stringify(want)) + '</div>');
}
</script>
<script src="tests.js"></script>
<script>
document.getElementById('out').innerHTML =
  '<h2>' + (failed ? failed + '개 실패' : '전부 통과') + '</h2>' + results.join('');
</script>
```

- [ ] **Step 4: 테스트 실행 — 기존 단언이 전부 통과하는지**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 마지막 줄 `23개 전부 통과`, exit 0.
(현재 `test.html`의 단언은 23개다 — `grep -c "^eq(" test.html`로 확인할 수 있다.
개수가 다르면 Step 1에서 옮기다 빠뜨린 것이다.)

- [ ] **Step 5: 커밋**

```bash
git add tests.js test-node.js test.html
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "test: 단언을 tests.js로 분리하고 Node 러너 추가"
```

---

### Task 2: `store.js` — 저장소와 Trip CRUD

**Files:**
- Create: `C:\Pcall\Trip\store.js`
- Modify: `C:\Pcall\Trip\tests.js` (단언 추가)
- Modify: `C:\Pcall\Trip\test-node.js` (로드 목록에 `store.js` 추가)
- Modify: `C:\Pcall\Trip\test.html` (script 태그 추가)
- Modify: `C:\Pcall\Trip\index.html` (script 태그 추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `SCHEMA: number` — `1`
  - `lsGet(key: string, fb: any): any`
  - `lsSet(key: string, v: any): void`
  - `lsDel(key: string): void`
  - `newTripId(): string` — `"t_"` + 36진수
  - `tripKey(id: string, k: string): string` — `"trip:<id>:<k>"`
  - `tripStore(id: string): { get(k, fb), set(k, v) }`
  - `listTrips(): Array<{id,title,start,end}>`
  - `saveTrip(trip): void` — `trip:<id>` 저장 + 인덱스 갱신(있으면 교체, 없으면 추가)
  - `loadTrip(id: string): Trip|null`
  - `deleteTrip(id: string): void` — Trip·런타임 키·인덱스 항목 모두 제거

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- store.js ----
__resetStorage();

eq('lsGet 기본값', lsGet('없는키', 42), 42);
lsSet('k', { a: 1 });
eq('lsSet/lsGet 왕복', lsGet('k', null), { a: 1 });
lsDel('k');
eq('lsDel 후 기본값', lsGet('k', 'gone'), 'gone');

eq('tripKey 조합', tripKey('t_1', 'spend'), 'trip:t_1:spend');
eq('newTripId 접두사', newTripId().slice(0, 2), 't_');
eq('newTripId 유일', newTripId() === newTripId(), false);

eq('빈 여행 목록', listTrips(), []);

var T1 = { schema: 1, id: 't_a', title: '오사카', start: '2026-07-28', end: '2026-08-03', days: [] };
saveTrip(T1);
eq('저장 후 목록', listTrips(),
  [{ id: 't_a', title: '오사카', start: '2026-07-28', end: '2026-08-03' }]);
eq('불러오기', loadTrip('t_a').title, '오사카');
eq('없는 여행', loadTrip('t_zzz'), null);

T1.title = '오사카 재방문';
saveTrip(T1);
eq('같은 id 재저장은 중복 안 만듦', listTrips().length, 1);
eq('인덱스 제목 갱신', listTrips()[0].title, '오사카 재방문');

var st = tripStore('t_a');
st.set('spend', [{ id: 1, jpy: 100 }]);
eq('여행별 저장소', st.get('spend', []), [{ id: 1, jpy: 100 }]);
eq('여행별 저장소는 raw 키를 쓴다', lsGet('trip:t_a:spend', null), [{ id: 1, jpy: 100 }]);
eq('다른 여행과 격리', tripStore('t_b').get('spend', []), []);

deleteTrip('t_a');
eq('삭제 후 목록', listTrips(), []);
eq('삭제 후 본체', loadTrip('t_a'), null);
eq('삭제 후 런타임 키도 제거', lsGet('trip:t_a:spend', 'gone'), 'gone');
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: lsGet is not defined` 로 즉시 중단.

- [ ] **Step 3: `store.js` 구현**

```js
var SCHEMA = 1;

function lsGet(key, fb) {
  try {
    var v = localStorage.getItem(key);
    return v === null ? fb : JSON.parse(v);
  } catch (e) { return fb; }
}
function lsSet(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

function newTripId() {
  return "t_" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

function tripKey(id, k) { return "trip:" + id + ":" + k; }

function tripStore(id) {
  return {
    get: function (k, fb) { return lsGet(tripKey(id, k), fb); },
    set: function (k, v) { lsSet(tripKey(id, k), v); }
  };
}

function listTrips() {
  var v = lsGet("trip:index", []);
  return Array.isArray(v) ? v : [];
}

function saveTrip(trip) {
  lsSet("trip:" + trip.id, trip);
  var idx = listTrips();
  var row = { id: trip.id, title: trip.title, start: trip.start, end: trip.end };
  var at = -1;
  idx.forEach(function (r, i) { if (r.id === trip.id) at = i; });
  if (at >= 0) idx[at] = row; else idx.push(row);
  lsSet("trip:index", idx);
}

function loadTrip(id) {
  return lsGet("trip:" + id, null);
}

// 여행 본체 + 그 여행의 런타임 키(trip:<id>:*) + 인덱스 항목을 모두 지운다.
function deleteTrip(id) {
  lsDel("trip:" + id);
  var prefix = tripKey(id, "");
  var doomed = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf(prefix) === 0) doomed.push(k);
  }
  doomed.forEach(lsDel);
  lsSet("trip:index", listTrips().filter(function (r) { return r.id !== id; }));
}
```

- [ ] **Step 4: 러너와 HTML에 `store.js` 등록**

`test-node.js`의 로드 목록을 `["store.js", "app.js", "tests.js"]`로 바꾼다.

`test.html`의 `<script src="app.js">` **앞**에 `<script src="store.js"></script>`를 넣는다.

`index.html`의 `<script src="data.js">` **앞**에 `<script src="store.js"></script>`를 넣는다.

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0, exit 0. 통과 개수는 23 + 이번에 추가한 18 = 41개.

- [ ] **Step 6: 커밋**

```bash
git add store.js tests.js test-node.js test.html index.html
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 여행 저장소(store.js) — Trip CRUD와 여행별 키 격리"
```

---

### Task 3: `schema.js` — 일차 생성과 기본값

여행 기간을 정하면 일차 배열이 자동 생성돼야 한다. 기간을 나중에 바꾸면 남는 날짜의 일정은 보존해야 한다 — 사용자가 하루 연장했다고 앞의 일정이 날아가면 안 된다.

**Files:**
- Create: `C:\Pcall\Trip\schema.js`
- Modify: `C:\Pcall\Trip\tests.js`
- Modify: `C:\Pcall\Trip\test-node.js`, `test.html`, `index.html` (script 등록)

**Interfaces:**
- Consumes: `SCHEMA`, `newTripId` (store.js)
- Produces:
  - `DOW: string[]` — `["일","월","화","수","목","금","토"]`
  - `dowOf(dateISO: string): string`
  - `addDays(dateISO: string, n: number): string`
  - `daysBetween(a: string, b: string): number` — 양끝 포함 일수
  - `newItemId(): string`
  - `newSectionId(): string`
  - `blankDay(n: number, dateISO: string): Day`
  - `buildDays(start: string, end: string): Day[]`
  - `resyncDays(days: Day[], start: string, end: string): Day[]` — 날짜가 유지되는 일차의 `items/meals/images/theme`를 보존하고 `n`을 1부터 다시 매긴다
  - `defaultSections(): Section[]` — 새 여행의 내장 섹션 4개
  - `emptyTrip(o: {title,start,end,party?,hotel?}): Trip`
  - `dayPlace(trip, day)` / `dayCurrency(trip, day)` — 오버라이드 상속 헬퍼 (2단계에서 쓰지만 스키마의 일부라 여기서 만든다)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- schema.js ----
eq('요일 파생', dowOf('2026-07-28'), '화');
eq('요일 일요일', dowOf('2026-08-02'), '일');
eq('날짜 더하기', addDays('2026-07-28', 3), '2026-07-31');
eq('월 넘김', addDays('2026-07-30', 5), '2026-08-04');
eq('기간 일수', daysBetween('2026-07-28', '2026-08-03'), 7);
eq('같은 날 하루', daysBetween('2026-07-28', '2026-07-28'), 1);

var D = buildDays('2026-07-28', '2026-07-30');
eq('일차 개수', D.length, 3);
eq('일차 번호와 날짜', D.map(function (d) { return d.n + ':' + d.date; }),
  ['1:2026-07-28', '2:2026-07-29', '3:2026-07-30']);
eq('빈 일차 형태', D[0],
  { n: 1, date: '2026-07-28', theme: '', place: null, curCode: null,
    items: [], meals: [], images: [] });

// 재동기화: 앞을 하루 자르고 뒤를 하루 늘려도 남는 날짜의 일정은 보존된다
D[1].items.push({ id: 'i_x', time: '09:00', text: '유니버셜' });
D[1].theme = '테마파크';
var R = resyncDays(D, '2026-07-29', '2026-07-31');
eq('재동기화 개수', R.length, 3);
eq('재동기화 번호 재부여', R.map(function (d) { return d.n + ':' + d.date; }),
  ['1:2026-07-29', '2:2026-07-30', '3:2026-07-31']);
eq('남은 날짜의 일정 보존', R[0].items, [{ id: 'i_x', time: '09:00', text: '유니버셜' }]);
eq('남은 날짜의 테마 보존', R[0].theme, '테마파크');
eq('새로 생긴 날짜는 비어 있음', R[2].items, []);

eq('내장 섹션 4개', defaultSections().map(function (s) { return s.body; }),
  ['hotel', 'packing', 'spend', 'expenses']);
eq('내장 섹션 타입', defaultSections()[0].type, 'builtin');

var NT = emptyTrip({ title: '방콕', start: '2026-09-01', end: '2026-09-04' });
eq('새 여행 스키마 버전', NT.schema, 1);
eq('새 여행 일차 수', NT.days.length, 4);
eq('새 여행 기본 인원', NT.party, 2);
eq('새 여행 기본 통화', NT.currency, { code: 'KRW', symbol: '₩', decimals: 0, unit: 1 });
eq('새 여행 빈 준비물', NT.packing, []);
eq('새 여행 id 접두사', NT.id.slice(0, 2), 't_');

// 상속 헬퍼
var TP = { place: { name: '파리' }, currency: { code: 'EUR' } };
eq('일차 장소 상속', dayPlace(TP, { place: null }), { name: '파리' });
eq('일차 장소 오버라이드', dayPlace(TP, { place: { name: '로마' } }), { name: '로마' });
eq('일차 통화 상속', dayCurrency(TP, { curCode: null }).code, 'EUR');
eq('일차 통화 오버라이드', dayCurrency(TP, { curCode: 'CHF' }).code, 'CHF');
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: dowOf is not defined`

- [ ] **Step 3: `schema.js` 구현**

```js
var DOW = ["일", "월", "화", "수", "목", "금", "토"];
var DAY_MS = 86400000;

function dateMs(iso) { return Date.parse(iso + "T00:00:00Z"); }
function msDate(ms) { return new Date(ms).toISOString().slice(0, 10); }

function dowOf(iso) { return DOW[new Date(dateMs(iso)).getUTCDay()]; }
function addDays(iso, n) { return msDate(dateMs(iso) + n * DAY_MS); }
function daysBetween(a, b) { return Math.round((dateMs(b) - dateMs(a)) / DAY_MS) + 1; }

var _seq = 0;
function newItemId() { return "i_" + Date.now().toString(36) + (_seq++).toString(36); }
function newSectionId() { return "s_" + Date.now().toString(36) + (_seq++).toString(36); }

function blankDay(n, iso) {
  return { n: n, date: iso, theme: "", place: null, curCode: null,
           items: [], meals: [], images: [] };
}

function buildDays(start, end) {
  var out = [], total = daysBetween(start, end);
  for (var i = 0; i < total; i++) out.push(blankDay(i + 1, addDays(start, i)));
  return out;
}

// 기간이 바뀌어도 날짜가 그대로 남는 일차의 내용은 보존한다.
function resyncDays(days, start, end) {
  var byDate = {};
  (days || []).forEach(function (d) { byDate[d.date] = d; });
  var out = [], total = daysBetween(start, end);
  for (var i = 0; i < total; i++) {
    var iso = addDays(start, i), old = byDate[iso];
    if (old) { old.n = i + 1; out.push(old); }
    else out.push(blankDay(i + 1, iso));
  }
  return out;
}

function defaultSections() {
  return [
    { id: newSectionId(), icon: "🏨", title: "숙소",      type: "builtin", body: "hotel" },
    { id: newSectionId(), icon: "🎒", title: "준비물",    type: "builtin", body: "packing" },
    { id: newSectionId(), icon: "💸", title: "현지 경비", type: "builtin", body: "spend" },
    { id: newSectionId(), icon: "💰", title: "경비 내역", type: "builtin", body: "expenses" }
  ];
}

function emptyTrip(o) {
  return {
    schema: SCHEMA,
    id: newTripId(),
    title: o.title,
    start: o.start,
    end: o.end,
    party: o.party || 2,
    place: null,
    currency: { code: "KRW", symbol: "₩", decimals: 0, unit: 1 },
    hotel: o.hotel || "",
    budgetKRW: 0,
    days: buildDays(o.start, o.end),
    sections: defaultSections(),
    packing: [],
    expenses: []
  };
}

// 일차별 오버라이드 상속. 2단계(다국가·다통화)에서 렌더가 이 두 함수만 쓴다.
function dayPlace(trip, day) {
  return (day && day.place) || trip.place;
}
function dayCurrency(trip, day) {
  if (day && day.curCode) return { code: day.curCode };
  return trip.currency;
}
```

- [ ] **Step 4: 러너와 HTML에 등록**

`test-node.js` 로드 목록: `["store.js", "schema.js", "app.js", "tests.js"]`
`test.html`·`index.html`: `store.js` 다음에 `<script src="schema.js"></script>`

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0, exit 0.

`dayCurrency`의 오버라이드 반환값이 `{code}`만 있는 얕은 객체인 점에 주의한다. 2단계에서 `money.js`의 통화 프리셋 조회로 대체된다 — 지금은 상속 분기만 검증한다.

- [ ] **Step 6: 커밋**

```bash
git add schema.js tests.js test-node.js test.html index.html
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: Trip 스키마 헬퍼 — 일차 생성·재동기화·기본값"
```

---

### Task 4: 오사카 여행 변환과 구 데이터 마이그레이션

`data.js`(구 스키마)를 새 스키마로 변환해 샘플 여행으로 번들하고, 기존 사용자(=나)의 localStorage를 새 키로 옮긴다.

**Files:**
- Create: `C:\Pcall\Trip\convert_sample.py`
- Create: `C:\Pcall\Trip\sample-trip.js` (스크립트가 생성)
- Modify: `C:\Pcall\Trip\store.js` (마이그레이션 함수 추가)
- Modify: `C:\Pcall\Trip\tests.js`
- Modify: `C:\Pcall\Trip\test-node.js`, `test.html`, `index.html`

**Interfaces:**
- Consumes: `lsGet`, `lsSet`, `lsDel`, `saveTrip`, `listTrips`, `newTripId` (store.js)
- Produces:
  - `window.SAMPLE_TRIP` — 새 스키마의 오사카 여행 (id 없음. 가져올 때 부여)
  - `migrateLegacy(): string|null` — 구 `osaka-trip:v1:*` 가 있으면 새 여행으로 이관하고 그 여행 id를 반환. 없으면 `null`. 이미 이관됐으면 `null`
  - `installSample(): string` — `SAMPLE_TRIP`을 새 id로 저장하고 id 반환

- [ ] **Step 1: 변환 스크립트 작성**

`convert_sample.py`:

```python
# -*- coding: utf-8 -*-
"""data.js(구 스키마) -> sample-trip.js(새 스키마) 1회 변환.
아코디언 순서를 원본 그대로 재현하려고 sections에 내장 섹션까지 함께 넣는다."""
import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE, "data.js"), encoding="utf-8") as f:
    src = f.read()
old = json.loads(re.sub(r"^\s*window\.TRIP\s*=\s*", "", src).rstrip().rstrip(";"))

meta = old["meta"]

days = []
for d in old["days"]:
    days.append({
        "n": d["n"], "date": d["date"], "theme": d.get("theme", ""),
        "place": None, "curCode": None,
        "items": [{"id": "i_%d_%d" % (d["n"], i), "time": it["time"], "text": it["text"]}
                  for i, it in enumerate(d.get("items", []))],
        "meals": d.get("meals", []),
        "images": [],
    })

def rapit_table(caption, rows):
    return {"caption": caption, "head": ["편", "출발", "도착"],
            "rows": [[r["type"], r["dep"], r["arr"]] for r in rows]}

sections = [
    {"id": "s_rapit", "icon": "🚄", "title": "라피트 시간표", "type": "table",
     "body": [rapit_table("간사이 → 난바", old["rapit"]["to"]),
              rapit_table("난바 → 간사이", old["rapit"]["from"])]},
    {"id": "s_hotel",    "icon": "🏨", "title": "숙소",      "type": "builtin", "body": "hotel"},
    {"id": "s_packing",  "icon": "🎒", "title": "준비물",    "type": "builtin", "body": "packing"},
    {"id": "s_spend",    "icon": "💸", "title": "현지 경비", "type": "builtin", "body": "spend"},
    {"id": "s_expenses", "icon": "💰", "title": "경비 내역", "type": "builtin", "body": "expenses"},
    {"id": "s_tips", "icon": "💡", "title": "팁", "type": "list", "body": old["tips"]},
]

trip = {
    "schema": 1,
    "title": meta["title"],
    "start": meta["start"], "end": meta["end"],
    "party": 2,
    "place": {"name": "오사카", "country": "일본",
              "lat": 34.69, "lon": 135.5, "tz": "Asia/Tokyo"},
    "currency": {"code": "JPY", "symbol": "¥", "decimals": 0, "unit": 100},
    "hotel": meta["hotel"],
    "budgetKRW": meta["totalCostKRW"],
    "days": days,
    "sections": sections,
    "packing": old["packing"],
    "expenses": old["expenses"],
}

out = os.path.join(BASE, "sample-trip.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.SAMPLE_TRIP = " +
            json.dumps(trip, ensure_ascii=False, indent=2) + ";\n")
print("wrote", out)
```

- [ ] **Step 2: 변환 실행과 결과 확인**

```bash
cd /c/Pcall/Trip && python convert_sample.py && node -e "
eval(require('fs').readFileSync('sample-trip.js','utf8').replace('window.','global.'));
var t = global.SAMPLE_TRIP;
console.log('days', t.days.length, '| items d1', t.days[0].items.length,
  '| sections', t.sections.map(function(s){return s.title;}).join(','),
  '| packing', t.packing.length, '| expenses', t.expenses.length);
"
```
Expected: `days 7 | items d1 6 | sections 라피트 시간표,숙소,준비물,현지 경비,경비 내역,팁 | packing 15 | expenses` (마지막 숫자는 data.js의 항목 수)

일차 7개·1일차 항목 6개가 아니면 `data.js`를 잘못 읽은 것이다.

- [ ] **Step 3: 마이그레이션 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- 마이그레이션 ----
__resetStorage();
eq('구 데이터 없으면 null', migrateLegacy(), null);

__resetStorage();
lsSet('osaka-trip:v1:spend', [{ id: 1, date: '2026-07-29', jpy: 1200, cat: '식비', note: '이치란' }]);
lsSet('osaka-trip:v1:fx', 920);
lsSet('osaka-trip:v1:packing_checked', { '여권 + 사본': true });
lsSet('osaka-trip:v1:packing_add', ['멀미약']);
lsSet('osaka-trip:v1:meal:2:0', '구시카츠 다루마');

var mid = migrateLegacy();
eq('이관 후 여행 id 반환', typeof mid, 'string');
eq('이관된 여행이 목록에 있음', listTrips().length, 1);
eq('이관된 여행 제목', loadTrip(mid).title, '오사카 여행');
eq('경비 이관', tripStore(mid).get('spend', []),
  [{ id: 1, date: '2026-07-29', jpy: 1200, cat: '식비', note: '이치란' }]);
eq('환율 이관', tripStore(mid).get('fx', 0), 920);
eq('준비물 체크 이관', tripStore(mid).get('packing_checked', {}), { '여권 + 사본': true });
eq('추가 준비물 이관', tripStore(mid).get('packing_add', []), ['멀미약']);
eq('식사 메모 이관', tripStore(mid).get('meal:2:0', ''), '구시카츠 다루마');
eq('구 키 제거', lsGet('osaka-trip:v1:spend', 'gone'), 'gone');
eq('두 번째 호출은 null', migrateLegacy(), null);

__resetStorage();
var sid = installSample();
eq('샘플 설치', loadTrip(sid).title, '오사카 여행');
eq('샘플에 id 부여', loadTrip(sid).id, sid);
eq('샘플 일차 수', loadTrip(sid).days.length, 7);
```

- [ ] **Step 4: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: migrateLegacy is not defined`

- [ ] **Step 5: `store.js`에 마이그레이션 구현**

`store.js` 끝에 추가:

```js
var LEGACY_PREFIX = "osaka-trip:v1:";
var LEGACY_KEYS = ["spend", "fx", "packing_checked", "packing_add", "weather"];

function cloneSample() {
  return JSON.parse(JSON.stringify(window.SAMPLE_TRIP));
}

function installSample() {
  var t = cloneSample();
  t.id = newTripId();
  saveTrip(t);
  return t.id;
}

// 구 osaka-trip:v1:* 를 새 여행 하나로 옮긴다. 옮길 게 없으면 null.
function migrateLegacy() {
  var found = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf(LEGACY_PREFIX) === 0) found.push(k);
  }
  if (!found.length) return null;

  var id = installSample();
  var st = tripStore(id);
  found.forEach(function (k) {
    var sub = k.slice(LEGACY_PREFIX.length);
    // 알려진 키와 meal:<n>:<i> 형태만 옮긴다
    if (LEGACY_KEYS.indexOf(sub) >= 0 || sub.indexOf("meal:") === 0) {
      st.set(sub, lsGet(k, null));
    }
  });
  found.forEach(lsDel);
  return id;
}
```

`localStorage.key(i)`로 순회하면서 같은 루프 안에서 지우면 인덱스가 밀린다. 위 구현은 먼저 `found`에 모으고 나중에 지우므로 안전하다.

- [ ] **Step 6: 러너와 HTML에 `sample-trip.js` 등록**

`test-node.js` 로드 목록: `["sample-trip.js", "store.js", "schema.js", "app.js", "tests.js"]`
(`sample-trip.js`가 `window.SAMPLE_TRIP`에 대입하는데 러너에서 `global.window = global`이므로 그대로 동작한다.)

`test.html`·`index.html`: `store.js` **앞**에 `<script src="sample-trip.js"></script>`

- [ ] **Step 7: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0, exit 0.

- [ ] **Step 8: 커밋**

```bash
git add convert_sample.py sample-trip.js store.js tests.js test-node.js test.html index.html
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 오사카 여행을 새 스키마 샘플로 변환하고 구 데이터 마이그레이션 추가"
```

---

### Task 5: `views.js` 분리 + 이스케이프 전면 적용

렌더 함수를 `app.js`에서 떼어내 `trip`을 인자로 받게 하고, 사용자 입력이 HTML로 해석되지 않게 막는다. **동작은 바뀌지 않는다 — 순수 리팩터링 + 보안 수정이다.**

**Files:**
- Create: `C:\Pcall\Trip\views.js`
- Modify: `C:\Pcall\Trip\app.js` (렌더 함수 제거)
- Modify: `C:\Pcall\Trip\tests.js`, `test-node.js`, `test.html`, `index.html`

**Interfaces:**
- Consumes: `dowOf` (schema.js), `tripStore` (store.js), `wxLine`/`wxState`/`wxStamp` (app.js에 남음)
- Produces:
  - `escHtml(s): string`
  - `itemLinesHtml(text: string): string` — 줄 분할 + ⏰/✅ 배지. **escape 후 배지 적용**
  - `isUndecided(text): boolean`
  - `dday(todayISO, startISO, endISO): string`
  - `renderSummary(trip, st): void`
  - `renderTabs(trip, selectedN, onSelect: function(n)): void`
  - `renderTimeline(trip, day, st): void`
  - `renderFixed(trip, st): void` — `trip.sections`를 순회. `type` 분기: builtin/text/list/table
  - `renderSpend(trip, st): void`
  - `renderPacking(trip, st): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- views.js 순수 함수 ----
eq('escHtml 기본', escHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
eq('escHtml 숫자', escHtml(3), '3');

eq('itemLinesHtml 한 줄',
  itemLinesHtml('도톤보리 구경'),
  '<div class="line">도톤보리 구경</div>');
eq('itemLinesHtml 여러 줄',
  itemLinesHtml('a\nb'),
  '<div class="line">a</div><div class="line">b</div>');
eq('itemLinesHtml 시간지정 배지',
  itemLinesHtml('닌텐도 월드(패스권-시간)'),
  '<div class="line timed"><span class="tag">⏰ 시간지정</span>닌텐도 월드(패스권-시간)</div>');
eq('itemLinesHtml 예약 배지',
  itemLinesHtml('스키야끼 후지모토 19:30 예약 완료'),
  '<div class="line booked"><span class="tag">✅ 예약완료</span>스키야끼 후지모토 19:30 예약 완료</div>');
eq('itemLinesHtml XSS 차단',
  itemLinesHtml('<img src=x onerror=alert(1)>'),
  '<div class="line">&lt;img src=x onerror=alert(1)&gt;</div>');
eq('itemLinesHtml 배지 줄도 escape',
  itemLinesHtml('<b>(시간)</b>'),
  '<div class="line timed"><span class="tag">⏰ 시간지정</span>&lt;b&gt;(시간)&lt;/b&gt;</div>');

eq('미정 판정 뭐먹지', isUndecided('뭐먹지'), true);
eq('미정 판정 물음표', isUndecided('라멘?'), true);
eq('미정 판정 빈칸', isUndecided('  '), true);
eq('미정 아님', isUndecided('이치란 라멘'), false);

eq('D-day 이전', dday('2026-07-25', '2026-07-28', '2026-08-03'), 'D-3');
eq('D-day 당일', dday('2026-07-28', '2026-07-28', '2026-08-03'), '여행 중 1일차');
eq('D-day 중간', dday('2026-07-30', '2026-07-28', '2026-08-03'), '여행 중 3일차');
eq('D-day 이후', dday('2026-08-05', '2026-07-28', '2026-08-03'), '여행 종료');
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `itemLinesHtml is not defined` (다른 함수는 아직 `app.js`에 있어 통과할 수 있다)

- [ ] **Step 3: `views.js` 생성 — `app.js`에서 렌더 이동**

`app.js`에서 다음 함수를 잘라내 `views.js`로 옮긴다:
`dday`, `renderSummary`, `summarySpend`, `isUndecided`, `renderTabs`, `usjMapSVG`,
`renderTimeline`, `selectDay`, `renderFixed`, `escHtml`, `renderSpend`, `renderPacking`,
그리고 `SPEND_CATS`, `spendList`, `spendFx`, `spendTotalJpy`, `jpyToKrw`, `spendByCat`,
`spendByDate`, `mealKey`.

`app.js`에 남기는 것: `todayLocal`, `WX_URL`, `wxIcon`, `wxDailyMap`, `wxLine`,
`wxState`, `wxStamp`, `wxRefresh`, `wxRepaint`, 그리고 부팅 코드.

옮기면서 다음을 바꾼다.

**(a) 전역 `store` 제거, 여행별 저장소를 인자로.** `spendList` 등이 `st`를 받는다:

```js
var SPEND_CATS = ["식비", "교통", "쇼핑", "관광", "기타"];

function spendList(st) {
  var v = st.get("spend", []);
  return Array.isArray(v) ? v : [];
}
function spendFx(st) {
  var n = Number(st.get("fx", 900));
  return isFinite(n) && n > 0 ? n : 0;
}
function mealKey(dayN, i) { return "meal:" + dayN + ":" + i; }
```

`spendTotalJpy`, `jpyToKrw`, `spendByCat`, `spendByDate`는 이미 순수 함수다 — 그대로 옮긴다.

**(b) `itemLinesHtml` 추출.** `renderTimeline` 안의 줄 분할 로직을 꺼내고 escape를 추가한다:

```js
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// escape를 먼저 하고, 배지 판정은 원본 텍스트로 한다.
function itemLinesHtml(text) {
  return String(text).split('\n').map(function (l) {
    var e = escHtml(l);
    if (/\(패스권-시간\)|\(시간\)/.test(l)) {
      return '<div class="line timed"><span class="tag">⏰ 시간지정</span>' + e + '</div>';
    }
    if (/예약 완료/.test(l)) {
      return '<div class="line booked"><span class="tag">✅ 예약완료</span>' + e + '</div>';
    }
    return '<div class="line">' + e + '</div>';
  }).join('');
}
```

**(c) `renderTimeline`을 `trip`/`day`/`st` 기반으로.** `usjMapSVG()`와 `day.n === 2` 분기를 **삭제**한다 (2단계에서 이미지 첨부로 대체). `day.dow` 대신 `dowOf(day.date)`:

```js
function renderTimeline(trip, day, st) {
  const main = document.getElementById("timeline");
  const rows = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    return '<div class="slot' + cls + '" data-item="' + escHtml(it.id) + '">' +
      '<div class="time">' + escHtml(it.time) + '</div>' +
      '<div class="what">' + itemLinesHtml(it.text) + '</div></div>';
  }).join('');
  const meals = (day.meals && day.meals.length)
    ? '<div class="meals"><div class="meals-h">🍽 뭐먹지</div>' +
      day.meals.map(function (m, i) {
        const val = escHtml(st.get(mealKey(day.n, i), ""));
        return '<div class="meal"><div class="meal-note">' + itemLinesHtml(m) + '</div>' +
          '<input class="memo" data-key="' + mealKey(day.n, i) +
          '" placeholder="식당/메모 입력" value="' + val + '"></div>';
      }).join('') + '</div>'
    : '';
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + day.n + '일차</span> ' +
      '<span class="ddate">' + escHtml(day.date) + '(' + dowOf(day.date) + ')</span>' +
      '<div class="dtheme">' + escHtml(day.theme).replace(/\n/g, ' · ') + '</div>' +
      (function () {
        var line = wxLine(wxState.map, day.date);
        return line ? '<div class="dwx">' + line + wxStamp() + '</div>' : '';
      })() + '</div>' +
      '<div class="slots">' + rows + '</div>' + meals + '</div>';
  main.querySelectorAll('.memo').forEach(function (inp) {
    inp.addEventListener('input', function () { st.set(inp.dataset.key, inp.value); });
  });
}
```

`data-item` 속성은 Task 8(일정 편집)에서 쓴다.

**(d) `renderTabs`에 콜백 인자.** `selectDay` 전역 호출을 없애고 라우터가 넘긴 함수를 쓴다:

```js
function renderTabs(trip, selectedN, onSelect) {
  const nav = document.getElementById("daytabs");
  nav.innerHTML = trip.days.map(function (d) {
    const on = d.n === selectedN ? ' data-selected="1"' : '';
    return '<button class="tab"' + on + ' data-n="' + d.n + '">' +
      '<span class="tn">' + d.n + '일차</span>' +
      '<span class="td">' + escHtml(d.date.slice(5)) + '(' + dowOf(d.date) + ')</span></button>';
  }).join('');
  nav.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { onSelect(parseInt(b.dataset.n, 10)); });
  });
  const sel = nav.querySelector('.tab[data-selected]');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ inline: "center", block: "nearest" });
}
```

마지막 두 줄이 긴 여행(탭 30개)에서 현재 일차가 화면 밖에 있는 문제를 막는다.

**(e) `renderSummary`를 `trip` 기반으로.** `meta.*` → `trip.*`, 모든 사용자 문자열에 `escHtml`:

```js
function renderSummary(trip, st) {
  const today = todayLocal();
  const el = document.getElementById("summary");
  const nights = daysBetween(trip.start, trip.end) - 1;
  el.innerHTML =
    '<div class="dday">' + dday(today, trip.start, trip.end) + '</div>' +
    '<h1>' + escHtml(trip.title) + '</h1>' +
    '<div class="period">' + escHtml(trip.start) + ' ~ ' + escHtml(trip.end) +
      ' · ' + nights + '박 ' + (nights + 1) + '일</div>' +
    (trip.hotel ? '<div class="hotel">🏨 ' + escHtml(trip.hotel) + '</div>' : '') +
    (function () {
      var line = wxLine(wxState.map, todayLocal());
      return line ? '<div class="wx">' + line.replace(" ", " 오늘 ") + wxStamp() + '</div>' : '';
    })() +
    (trip.budgetKRW
      ? '<div class="cost">💰 총 ' + trip.budgetKRW.toLocaleString('ko-KR') + '원 (' +
        trip.party + '인)' + summarySpend(st) + '</div>'
      : '');
}
```

**(f) `renderFixed`를 `sections` 순회로.** 라피트 전용 렌더를 삭제하고 데이터 주도로:

```js
function sectionBodyHtml(trip, sec) {
  if (sec.type === "builtin") {
    if (sec.body === "hotel")    return escHtml(trip.hotel);
    if (sec.body === "packing")  return '<div id="packing-body"></div>';
    if (sec.body === "spend")    return '<div id="spend-body"></div>';
    if (sec.body === "expenses") return expensesTableHtml(trip);
    return '';
  }
  if (sec.type === "text") return itemLinesHtml(sec.body);
  if (sec.type === "list") {
    return '<ul>' + sec.body.map(function (t) {
      return '<li>' + escHtml(t) + '</li>';
    }).join('') + '</ul>';
  }
  if (sec.type === "table") {
    return sec.body.map(function (tb) {
      return '<div class="tblwrap"><table>' +
        (tb.caption ? '<caption>' + escHtml(tb.caption) + '</caption>' : '') +
        '<thead><tr>' + tb.head.map(function (h) {
          return '<th>' + escHtml(h) + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        tb.rows.map(function (r) {
          return '<tr>' + r.map(function (c) {
            return '<td>' + escHtml(c) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
  }
  return '';
}

function expensesTableHtml(trip) {
  const rows = trip.expenses.map(function (e) {
    return '<tr><td>' + escHtml(e.cat) + '</td><td>' + escHtml(e.detail) + '</td>' +
      '<td class="num">' + Number(e.krw).toLocaleString('ko-KR') + '</td></tr>';
  }).join('');
  const total = trip.expenses.reduce(function (s, e) { return s + Number(e.krw || 0); }, 0);
  return '<div class="tblwrap"><table>' +
    '<thead><tr><th>항목</th><th>상세</th><th class="num">금액(원)</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td colspan="2">합계</td><td class="num">' +
      total.toLocaleString('ko-KR') + '</td></tr></tfoot></table></div>';
}

function renderFixed(trip, st) {
  document.getElementById("fixed").innerHTML = trip.sections.map(function (sec, i) {
    return '<details' + (i === 0 ? ' open' : '') + '>' +
      '<summary>' + escHtml(sec.icon) + ' ' + escHtml(sec.title) + '</summary>' +
      '<div class="acc">' + sectionBodyHtml(trip, sec) + '</div></details>';
  }).join('');
  renderPacking(trip, st);
  renderSpend(trip, st);
}
```

`expensesTableHtml`이 합계를 `trip.expenses`에서 직접 계산한다 — 기존에는 `meta.totalCostKRW`를 썼는데, 사용자가 항목을 추가하면 합계가 안 맞게 된다.

**(g) `renderSpend`/`renderPacking`에 `trip`/`st` 전달.** 본문 로직은 그대로 두되 `store.get/set` → `st.get/set`, `window.TRIP.packing` → `trip.packing`, `renderSummary(window.TRIP.meta)` → `renderSummary(trip, st)`로 바꾼다. 경비 목록의 `escHtml(e.note || e.cat)`은 이미 있다 — 유지한다.

- [ ] **Step 4: 러너와 HTML에 등록**

`test-node.js` 로드 목록: `["sample-trip.js", "store.js", "schema.js", "views.js", "app.js", "tests.js"]`
`test.html`·`index.html`: `schema.js` 다음에 `<script src="views.js"></script>`

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0. 기존 경비·날씨 단언도 그대로 통과해야 한다. `spendList`/`spendFx`가 `st` 인자를 받게 바뀌었으므로 `tests.js`의 해당 단언을 확인한다 — 기존 단언은 `spendTotalJpy`·`spendByCat`·`spendByDate`·`jpyToKrw`만 쓰므로 수정 불필요하다.

- [ ] **Step 6: 커밋**

```bash
git add views.js app.js tests.js test-node.js test.html index.html
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "refactor: 렌더를 views.js로 분리하고 사용자 입력 이스케이프 적용"
```

---

### Task 6: `app.js` 라우터와 여행 목록 화면

**Files:**
- Modify: `C:\Pcall\Trip\index.html` (화면 컨테이너 추가)
- Modify: `C:\Pcall\Trip\app.js` (라우터로 축소)
- Modify: `C:\Pcall\Trip\styles.css` (목록 화면 스타일)
- Delete: `C:\Pcall\Trip\data.js`, `C:\Pcall\Trip\gen_data.py`

**Interfaces:**
- Consumes: `listTrips`, `loadTrip`, `deleteTrip`, `installSample`, `migrateLegacy` (store.js), `renderSummary`/`renderTabs`/`renderTimeline`/`renderFixed` (views.js), `wxRefresh` (app.js)
- Produces:
  - `go(hash: string): void` — `location.hash` 변경
  - `route(): void` — 해시 파싱 후 해당 화면 렌더
  - `showList(): void`
  - `showTrip(id: string, dayN?: number): void`
  - `currentTrip(): Trip|null`

- [ ] **Step 1: `index.html` 화면 컨테이너**

`<body>` 내용을 다음으로 교체한다:

```html
<body>
  <section id="screen-list" hidden>
    <header class="lhead"><h1>내 여행</h1></header>
    <div id="triplist"></div>
    <div class="lactions">
      <button id="new-trip" type="button">+ 새 여행 만들기</button>
      <button id="add-sample" type="button">샘플 여행 보기</button>
    </div>
  </section>

  <section id="screen-trip" hidden>
    <header id="summary"></header>
    <nav id="daytabs"></nav>
    <main id="timeline"></main>
    <section id="fixed"></section>
  </section>

  <section id="screen-edit" hidden></section>

  <script src="sample-trip.js"></script>
  <script src="store.js"></script>
  <script src="schema.js"></script>
  <script src="views.js"></script>
  <script src="editor.js"></script>
  <script src="app.js"></script>
  <script>
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  </script>
</body>
```

`editor.js`는 Task 7에서 만든다. 지금은 빈 파일을 만들어 둔다:

```bash
cd /c/Pcall/Trip && echo "// 여행 만들기·설정, 일정 편집 (Task 7-8)" > editor.js
```

- [ ] **Step 2: `app.js`를 라우터로 교체**

`app.js`에서 부팅 코드(`DOMContentLoaded` 핸들러)를 지우고 다음으로 대체한다. 날씨 함수(`WX_URL`, `wxIcon`, `wxDailyMap`, `wxLine`, `wxState`, `wxStamp`, `wxRefresh`, `wxRepaint`)와 `todayLocal`은 파일 위쪽에 그대로 둔다.

```js
var CUR = { id: null, trip: null, st: null, dayN: null };

function currentTrip() { return CUR.trip; }

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function showScreen(which) {
  ["list", "trip", "edit"].forEach(function (s) {
    document.getElementById("screen-" + s).hidden = (s !== which);
  });
}

function showList() {
  showScreen("list");
  var trips = listTrips();
  document.getElementById("triplist").innerHTML = trips.length
    ? trips.map(function (t) {
        return '<article class="tripcard" data-id="' + escHtml(t.id) + '">' +
          '<div class="tc-title">' + escHtml(t.title) + '</div>' +
          '<div class="tc-period">' + escHtml(t.start) + ' ~ ' + escHtml(t.end) + '</div>' +
          '<div class="tc-dday">' + dday(todayLocal(), t.start, t.end) + '</div>' +
          '<button class="tc-del" type="button" aria-label="삭제">×</button></article>';
      }).join('')
    : '<p class="empty">아직 여행이 없습니다. 새로 만들어 보세요.</p>';

  document.querySelectorAll('.tripcard').forEach(function (c) {
    c.addEventListener('click', function (e) {
      if (e.target.classList.contains('tc-del')) return;
      go('#/t/' + c.dataset.id);
    });
  });
  document.querySelectorAll('.tc-del').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = b.closest('.tripcard');
      var name = card.querySelector('.tc-title').textContent;
      if (!confirm('"' + name + '" 여행을 삭제할까요? 되돌릴 수 없습니다.')) return;
      deleteTrip(card.dataset.id);
      showList();
    });
  });
}

function showTrip(id, dayN) {
  var trip = loadTrip(id);
  if (!trip) { go('#/'); return; }
  CUR.id = id; CUR.trip = trip; CUR.st = tripStore(id);
  showScreen("trip");

  var today = todayLocal();
  var day = null;
  if (dayN) day = trip.days.filter(function (d) { return d.n === dayN; })[0];
  if (!day) day = trip.days.filter(function (d) { return d.date === today; })[0];
  if (!day) day = today < trip.days[0].date ? trip.days[0] : trip.days[trip.days.length - 1];
  CUR.dayN = day.n;

  renderSummary(trip, CUR.st);
  renderTabs(trip, day.n, function (n) { go('#/t/' + id + '/d/' + n); });
  renderTimeline(trip, day, CUR.st);
  renderFixed(trip, CUR.st);
  wxRefresh();
}

function route() {
  var h = location.hash || "#/";
  var m = h.match(/^#\/t\/([^/]+)(?:\/d\/(\d+))?$/);
  if (m) { showTrip(m[1], m[2] ? parseInt(m[2], 10) : null); return; }
  if (/^#\/t\/[^/]+\/edit$/.test(h)) { showEdit(h.split('/')[2]); return; }
  if (h === "#/new") { showEdit(null); return; }
  showList();
}

// 날씨 갱신 후 현재 화면만 다시 그린다.
function wxRepaint() {
  if (CUR.trip && !document.getElementById("screen-trip").hidden) {
    showTrip(CUR.id, CUR.dayN);
  }
}

window.addEventListener("hashchange", route);

document.addEventListener("DOMContentLoaded", function () {
  migrateLegacy();

  document.getElementById("new-trip")
    .addEventListener("click", function () { go('#/new'); });
  document.getElementById("add-sample")
    .addEventListener("click", function () { go('#/t/' + installSample()); });

  // 여행이 하나뿐이면 목록을 건너뛰고 바로 연다.
  var trips = listTrips();
  if (!location.hash && trips.length === 1) { go('#/t/' + trips[0].id); return; }
  route();
});
```

`wxRepaint`가 `showTrip`을 다시 부르면 스크롤이 튈 수 있다. 실제로 확인하고, 튀면 `renderSummary`·`renderTimeline`만 다시 부르도록 좁힌다.

- [ ] **Step 3: 구 파일 삭제**

```bash
cd /c/Pcall/Trip && git rm data.js gen_data.py
```

`sample-trip.js`가 오사카 데이터를 담고 있고 `convert_sample.py`가 변환 기록을 남기므로 둘 다 역할이 끝났다.

- [ ] **Step 4: 목록 화면 스타일 추가**

`styles.css` 끝에 추가:

```css
.lhead { background:var(--accent); color:#fff; padding:20px 16px; }
.lhead h1 { margin:0; font-size:1.4rem; }
#triplist { padding:12px; }
.tripcard { position:relative; background:var(--card); border-radius:14px; padding:14px 16px;
  margin-bottom:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); cursor:pointer; }
.tripcard .tc-title { font-weight:700; font-size:1.05rem; }
.tripcard .tc-period { color:var(--muted); font-size:.85rem; margin-top:2px; }
.tripcard .tc-dday { color:var(--accent); font-weight:700; font-size:.8rem; margin-top:4px; }
.tripcard .tc-del { position:absolute; top:10px; right:10px; border:0; background:none;
  color:var(--muted); font-size:1.2rem; line-height:1; padding:4px 8px; cursor:pointer; }
#triplist .empty { color:var(--muted); text-align:center; padding:32px 16px; }
.lactions { display:flex; flex-direction:column; gap:8px; padding:0 12px 24px; }
.lactions button { font:inherit; padding:12px; border-radius:12px; border:1px solid #d5dde1;
  background:var(--card); color:var(--text); cursor:pointer; }
.lactions #new-trip { background:var(--accent); color:#fff; border-color:var(--accent);
  font-weight:700; }
```

- [ ] **Step 5: 수동 확인**

```bash
cd /c/Pcall/Trip && python -m http.server 8000
```

브라우저에서 `http://localhost:8000/` 열고 DevTools 콘솔에서 `localStorage.clear()` 후 새로고침. 다음을 확인한다:

1. 빈 목록 화면 + "아직 여행이 없습니다"
2. "샘플 여행 보기" → 오사카 여행이 열리고, 일차 탭 7개, 1일차 타임라인, 하단 아코디언이 **라피트 → 숙소 → 준비물 → 현지 경비 → 경비 내역 → 팁** 순
3. 일차 탭 클릭 시 URL이 `#/t/…/d/3`로 바뀌고 해당 일차가 보임
4. 브라우저 뒤로가기로 이전 일차로 돌아감
5. `#/`로 이동 → 목록에 오사카 여행 카드 1개
6. 카드의 × → 확인 후 삭제

USJ 지도가 사라진 것은 의도된 동작이다 (2단계에서 이미지 첨부로 복구).

- [ ] **Step 6: 커밋**

```bash
git add index.html app.js styles.css editor.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 해시 라우터와 여행 목록 화면, data.js 하드코딩 제거"
```

---

### Task 7: `editor.js` — 여행 만들기와 설정

**Files:**
- Modify: `C:\Pcall\Trip\editor.js`
- Modify: `C:\Pcall\Trip\styles.css`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: `emptyTrip`, `resyncDays`, `daysBetween` (schema.js), `saveTrip`, `loadTrip` (store.js), `escHtml` (views.js), `go` (app.js)
- Produces:
  - `showEdit(id: string|null): void` — `null`이면 새 여행 만들기
  - `applyTripForm(trip: Trip|null, form: {title,start,end,party,hotel}): Trip` — 순수. 새 여행이면 생성, 기존이면 필드 갱신 + `resyncDays`
  - `validateTripForm(form): string|null` — 오류 메시지 또는 `null`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- editor.js 순수 로직 ----
eq('폼 검증 통과',
  validateTripForm({ title: '방콕', start: '2026-09-01', end: '2026-09-04', party: 2 }), null);
eq('제목 없음',
  validateTripForm({ title: '  ', start: '2026-09-01', end: '2026-09-04', party: 2 }),
  '여행 제목을 입력하세요.');
eq('날짜 없음',
  validateTripForm({ title: '방콕', start: '', end: '2026-09-04', party: 2 }),
  '시작일과 종료일을 입력하세요.');
eq('종료가 시작보다 빠름',
  validateTripForm({ title: '방콕', start: '2026-09-05', end: '2026-09-04', party: 2 }),
  '종료일이 시작일보다 빠릅니다.');
eq('너무 긴 여행',
  validateTripForm({ title: '세계일주', start: '2026-01-01', end: '2027-01-01', party: 2 }),
  '여행 기간은 최대 90일입니다.');
eq('인원 0',
  validateTripForm({ title: '방콕', start: '2026-09-01', end: '2026-09-04', party: 0 }),
  '인원은 1명 이상이어야 합니다.');

var made = applyTripForm(null,
  { title: '방콕', start: '2026-09-01', end: '2026-09-04', party: 3, hotel: '아속' });
eq('새 여행 제목', made.title, '방콕');
eq('새 여행 일차', made.days.length, 4);
eq('새 여행 인원', made.party, 3);
eq('새 여행 숙소', made.hotel, '아속');

made.days[1].items.push({ id: 'i_k', time: '10:00', text: '왕궁' });
var edited = applyTripForm(made,
  { title: '방콕 5일', start: '2026-09-01', end: '2026-09-05', party: 3, hotel: '아속' });
eq('기간 연장 후 일차', edited.days.length, 5);
eq('연장해도 기존 일정 보존', edited.days[1].items, [{ id: 'i_k', time: '10:00', text: '왕궁' }]);
eq('id 유지', edited.id, made.id);
eq('제목 갱신', edited.title, '방콕 5일');
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `validateTripForm is not defined`

- [ ] **Step 3: `editor.js` 구현**

```js
var MAX_TRIP_DAYS = 90;

function validateTripForm(f) {
  if (!f.title || !f.title.trim()) return '여행 제목을 입력하세요.';
  if (!f.start || !f.end) return '시작일과 종료일을 입력하세요.';
  if (f.end < f.start) return '종료일이 시작일보다 빠릅니다.';
  if (daysBetween(f.start, f.end) > MAX_TRIP_DAYS) return '여행 기간은 최대 90일입니다.';
  if (!(Number(f.party) >= 1)) return '인원은 1명 이상이어야 합니다.';
  return null;
}

// trip이 null이면 새로 만들고, 있으면 필드를 갱신한다. days는 항상 재동기화한다.
function applyTripForm(trip, f) {
  if (!trip) {
    return emptyTrip({ title: f.title.trim(), start: f.start, end: f.end,
                       party: Number(f.party), hotel: (f.hotel || '').trim() });
  }
  trip.title = f.title.trim();
  trip.start = f.start;
  trip.end = f.end;
  trip.party = Number(f.party);
  trip.hotel = (f.hotel || '').trim();
  trip.days = resyncDays(trip.days, f.start, f.end);
  return trip;
}

function showEdit(id) {
  var trip = id ? loadTrip(id) : null;
  if (id && !trip) { go('#/'); return; }
  var el = document.getElementById("screen-edit");
  ["list", "trip", "edit"].forEach(function (s) {
    document.getElementById("screen-" + s).hidden = (s !== "edit");
  });

  el.innerHTML =
    '<header class="ehead"><button id="e-back" type="button">←</button>' +
    '<h1>' + (trip ? '여행 설정' : '새 여행') + '</h1></header>' +
    '<form id="trip-form" class="eform">' +
      '<label>제목<input name="title" type="text" required placeholder="예: 오사카 여행" ' +
        'value="' + escHtml(trip ? trip.title : '') + '"></label>' +
      '<label>시작일<input name="start" type="date" required ' +
        'value="' + escHtml(trip ? trip.start : '') + '"></label>' +
      '<label>종료일<input name="end" type="date" required ' +
        'value="' + escHtml(trip ? trip.end : '') + '"></label>' +
      '<label>인원<input name="party" type="number" min="1" step="1" ' +
        'value="' + (trip ? trip.party : 2) + '"></label>' +
      '<label>숙소<textarea name="hotel" rows="2" ' +
        'placeholder="숙소명 · 체크인/아웃">' + escHtml(trip ? trip.hotel : '') + '</textarea></label>' +
      '<div class="eerr" id="e-err" hidden></div>' +
      '<button type="submit">' + (trip ? '저장' : '만들기') + '</button>' +
    '</form>';

  document.getElementById("e-back").addEventListener("click", function () {
    go(trip ? '#/t/' + trip.id : '#/');
  });

  document.getElementById("trip-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var f = { title: fd.get('title'), start: fd.get('start'), end: fd.get('end'),
              party: fd.get('party'), hotel: fd.get('hotel') };
    var err = validateTripForm(f);
    var box = document.getElementById("e-err");
    if (err) { box.textContent = err; box.hidden = false; return; }
    box.hidden = true;
    var saved = applyTripForm(trip, f);
    saveTrip(saved);
    go('#/t/' + saved.id);
  });
}
```

- [ ] **Step 4: 여행 상세에 "설정" 진입점 추가**

`views.js`의 `renderSummary`에서 `<h1>` 앞에 편집 버튼을 넣는다:

```js
    '<button class="edit-trip" type="button" aria-label="여행 설정">⚙</button>' +
    '<div class="dday">' + dday(today, trip.start, trip.end) + '</div>' +
```

그리고 `renderSummary` 끝(`el.innerHTML = …` 다음)에 핸들러를 붙인다:

```js
  var eb = el.querySelector('.edit-trip');
  if (eb) eb.addEventListener('click', function () { go('#/t/' + trip.id + '/edit'); });
```

- [ ] **Step 5: 스타일 추가**

`styles.css` 끝에 추가:

```css
#summary { position:relative; }
.edit-trip { position:absolute; top:16px; right:14px; border:0; background:rgba(255,255,255,.18);
  color:#fff; font-size:1.05rem; line-height:1; padding:7px 10px; border-radius:10px; cursor:pointer; }
.ehead { background:var(--accent); color:#fff; padding:16px; display:flex; align-items:center; gap:10px; }
.ehead h1 { margin:0; font-size:1.2rem; }
.ehead button { border:0; background:none; color:#fff; font-size:1.3rem; cursor:pointer; padding:0 4px; }
.eform { display:flex; flex-direction:column; gap:14px; padding:16px; }
.eform label { display:flex; flex-direction:column; gap:5px; font-size:.85rem; color:var(--muted); }
.eform input, .eform textarea, .eform select { font:inherit; color:var(--text);
  padding:10px; border:1px solid #d5dde1; border-radius:10px; background:var(--card); }
.eform button[type=submit] { font:inherit; font-weight:700; padding:13px; border:0;
  border-radius:12px; background:var(--accent); color:#fff; cursor:pointer; }
.eerr { background:#fff0f0; color:#c92a2a; border-left:4px solid #e03131;
  padding:9px 12px; border-radius:8px; font-size:.85rem; }
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0, exit 0.

`editor.js`를 러너 로드 목록에 넣는다: `["sample-trip.js", "store.js", "schema.js", "views.js", "editor.js", "app.js", "tests.js"]`. `test.html`에도 `<script src="editor.js"></script>`를 `views.js` 다음에 추가한다.

- [ ] **Step 7: 수동 확인**

`python -m http.server 8000` 후:

1. 목록 → "새 여행 만들기" → 제목 비우고 제출 → "여행 제목을 입력하세요."
2. 종료일을 시작일보다 앞으로 → "종료일이 시작일보다 빠릅니다."
3. 정상 입력(방콕, 2026-09-01~09-04, 3인) → 저장 후 여행 화면. 일차 탭 4개, 요일 정확
4. ⚙ → 종료일을 09-05로 연장 → 저장 → 일차 5개. 다시 09-03으로 줄여도 앞 일차는 유지

- [ ] **Step 8: 커밋**

```bash
git add editor.js views.js styles.css tests.js test-node.js test.html
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 여행 만들기·설정 화면과 기간 변경 시 일정 보존"
```

---

### Task 8: 일정 카드 편집

여행 화면에서 일정을 직접 추가·수정·삭제한다. 이것이 있어야 "남이 쓸 수 있는 앱"이 완성된다.

**Files:**
- Modify: `C:\Pcall\Trip\editor.js`
- Modify: `C:\Pcall\Trip\views.js` (편집 모드 토글과 버튼)
- Modify: `C:\Pcall\Trip\styles.css`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: `newItemId` (schema.js), `saveTrip` (store.js), `escHtml` (views.js)
- Produces:
  - `addItem(trip, dayN, {time, text}): Trip` — 순수. 시간 오름차순 삽입
  - `updateItem(trip, dayN, itemId, {time, text}): Trip`
  - `removeItem(trip, dayN, itemId): Trip`
  - `sortItems(items): items` — `time` 오름차순, 같으면 원래 순서 유지
  - `EDIT_MODE: boolean` — 여행 화면의 편집 토글 상태

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- 일정 카드 편집 ----
function fixture() {
  return { id: 't_e', days: [
    { n: 1, date: '2026-09-01', items: [
      { id: 'a', time: '09:00', text: '출발' },
      { id: 'b', time: '14:00', text: '체크인' }
    ] },
    { n: 2, date: '2026-09-02', items: [] }
  ] };
}

eq('시간 정렬', sortItems([
  { id: 'x', time: '14:00' }, { id: 'y', time: '09:00' }, { id: 'z', time: '11:30' }
]).map(function (i) { return i.id; }), ['y', 'z', 'x']);
eq('같은 시간은 원래 순서', sortItems([
  { id: 'p', time: '09:00' }, { id: 'q', time: '09:00' }
]).map(function (i) { return i.id; }), ['p', 'q']);

var F = fixture();
addItem(F, 1, { time: '11:00', text: '점심' });
eq('추가 후 개수', F.days[0].items.length, 3);
eq('시간순 삽입', F.days[0].items.map(function (i) { return i.time; }),
  ['09:00', '11:00', '14:00']);
eq('추가 항목에 id 부여', F.days[0].items[1].id.slice(0, 2), 'i_');

var F2 = fixture();
updateItem(F2, 1, 'b', { time: '15:30', text: '체크인 변경' });
eq('수정된 텍스트', F2.days[0].items[1].text, '체크인 변경');
eq('수정된 시간', F2.days[0].items[1].time, '15:30');
eq('수정 후에도 정렬 유지', F2.days[0].items.map(function (i) { return i.time; }),
  ['09:00', '15:30']);

var F3 = fixture();
removeItem(F3, 1, 'a');
eq('삭제 후 개수', F3.days[0].items.length, 1);
eq('남은 항목', F3.days[0].items[0].id, 'b');

var F4 = fixture();
removeItem(F4, 1, '없는id');
eq('없는 id 삭제는 무해', F4.days[0].items.length, 2);
addItem(F4, 99, { time: '09:00', text: '없는 일차' });
eq('없는 일차 추가는 무해', F4.days.length, 2);

var F5 = fixture();
addItem(F5, 2, { time: '08:00', text: '첫 항목' });
eq('빈 일차에 추가', F5.days[1].items.length, 1);
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `sortItems is not defined`

- [ ] **Step 3: `editor.js`에 항목 CRUD 구현**

`editor.js` 끝에 추가:

```js
// 안정 정렬 — 같은 시간이면 원래 순서를 유지한다.
function sortItems(items) {
  return items.map(function (it, i) { return { it: it, i: i }; })
    .sort(function (a, b) {
      if (a.it.time === b.it.time) return a.i - b.i;
      return a.it.time < b.it.time ? -1 : 1;
    })
    .map(function (w) { return w.it; });
}

function findDay(trip, dayN) {
  return trip.days.filter(function (d) { return d.n === dayN; })[0] || null;
}

function addItem(trip, dayN, o) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.items.push({ id: newItemId(), time: o.time, text: o.text });
  day.items = sortItems(day.items);
  return trip;
}

function updateItem(trip, dayN, itemId, o) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.items.forEach(function (it) {
    if (it.id !== itemId) return;
    it.time = o.time;
    it.text = o.text;
  });
  day.items = sortItems(day.items);
  return trip;
}

function removeItem(trip, dayN, itemId) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.items = day.items.filter(function (it) { return it.id !== itemId; });
  return trip;
}
```

- [ ] **Step 4: 편집 모드 UI**

`views.js`의 `renderTimeline`을 편집 모드에 반응하게 고친다. 파일 위쪽에 상태를 둔다:

```js
var EDIT_MODE = false;
```

`renderTimeline`의 `rows` 생성에서 편집 모드일 때 버튼을 붙인다:

```js
  const rows = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    const btns = EDIT_MODE
      ? '<div class="slot-btns">' +
        '<button class="it-edit" type="button" data-id="' + escHtml(it.id) + '">수정</button>' +
        '<button class="it-del" type="button" data-id="' + escHtml(it.id) + '">삭제</button></div>'
      : '';
    return '<div class="slot' + cls + '" data-item="' + escHtml(it.id) + '">' +
      '<div class="time">' + escHtml(it.time) + '</div>' +
      '<div class="what">' + itemLinesHtml(it.text) + btns + '</div></div>';
  }).join('');
```

`main.innerHTML` 조립에서 `'<div class="slots">' + rows + '</div>'` 뒤에 추가 폼을 넣는다:

```js
      '<div class="slots">' + rows + '</div>' +
      (EDIT_MODE
        ? '<form class="item-add">' +
          '<input class="ia-time" type="time" step="300" required aria-label="시간">' +
          '<textarea class="ia-text" rows="2" placeholder="일정 내용" required ' +
            'aria-label="일정 내용"></textarea>' +
          '<button type="submit">일정 추가</button></form>'
        : '') +
      meals + '</div>';
```

그리고 `main.querySelectorAll('.memo')` 핸들러 다음에 편집 핸들러를 붙인다:

```js
  if (EDIT_MODE) {
    main.querySelectorAll('.it-del').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('이 일정을 삭제할까요?')) return;
        removeItem(trip, day.n, b.dataset.id);
        saveTrip(trip);
        renderTimeline(trip, day, st);
      });
    });
    main.querySelectorAll('.it-edit').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = day.items.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (!it) return;
        var time = prompt('시간 (HH:MM)', it.time);
        if (time === null) return;
        var text = prompt('일정 내용', it.text);
        if (text === null) return;
        updateItem(trip, day.n, it.id, { time: time, text: text });
        saveTrip(trip);
        renderTimeline(trip, day, st);
      });
    });
    var af = main.querySelector('.item-add');
    if (af) af.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = af.querySelector('.ia-time').value;
      var x = af.querySelector('.ia-text').value.trim();
      if (!t || !x) return;
      addItem(trip, day.n, { time: t, text: x });
      saveTrip(trip);
      renderTimeline(trip, day, st);
    });
  }
```

`prompt`는 모달 다이얼로그다 — 이 앱은 사용자가 직접 조작하므로 문제없다. 인라인 편집 폼은 3단계 이후 개선 대상으로 남긴다.

`renderSummary`에 편집 토글 버튼을 추가한다. `.edit-trip` 버튼 옆에:

```js
    '<button class="edit-mode" type="button" aria-pressed="' + (EDIT_MODE ? 'true' : 'false') +
      '">' + (EDIT_MODE ? '완료' : '편집') + '</button>' +
```

핸들러:

```js
  var mb = el.querySelector('.edit-mode');
  if (mb) mb.addEventListener('click', function () {
    EDIT_MODE = !EDIT_MODE;
    showTrip(trip.id, CUR.dayN);
  });
```

- [ ] **Step 5: 스타일 추가**

`styles.css` 끝에 추가:

```css
.edit-mode { position:absolute; top:16px; right:52px; border:0; background:rgba(255,255,255,.18);
  color:#fff; font-size:.8rem; font-weight:700; line-height:1; padding:8px 10px;
  border-radius:10px; cursor:pointer; }
.edit-mode[aria-pressed=true] { background:#fff; color:var(--accent); }
.slot-btns { display:flex; gap:6px; margin-top:6px; }
.slot-btns button { font:inherit; font-size:.75rem; padding:4px 10px; border-radius:8px;
  border:1px solid #d5dde1; background:var(--card); color:var(--muted); cursor:pointer; }
.slot-btns .it-del { color:#c92a2a; border-color:#ffc9c9; }
.item-add { display:flex; flex-wrap:wrap; gap:8px; padding:12px 16px; border-top:1px dashed #dde4e8; }
.item-add .ia-time { flex:0 0 110px; }
.item-add .ia-text { flex:1 1 100%; }
.item-add input, .item-add textarea { font:inherit; padding:9px; border:1px solid #d5dde1;
  border-radius:10px; background:var(--card); color:var(--text); }
.item-add button { font:inherit; font-weight:700; padding:9px 16px; border:0; border-radius:10px;
  background:var(--accent); color:#fff; cursor:pointer; }
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0, exit 0.

- [ ] **Step 7: 수동 확인**

1. 새 여행을 만들고 "편집" 토글 → 각 일정에 수정/삭제 버튼, 하단에 추가 폼
2. 09:00 "공항 출발", 14:00 "체크인", 11:00 "점심" 순서로 추가 → **09:00 / 11:00 / 14:00** 순으로 정렬
3. 새로고침 후에도 유지
4. 수정 → 시간을 15:00으로 → 순서가 다시 정렬됨
5. 삭제 → 확인 후 사라지고 새로고침해도 안 돌아옴
6. 일정 내용에 `<img src=x onerror=alert(1)>` 입력 → **alert이 뜨지 않고 글자 그대로** 보임
7. "완료" 토글 → 버튼이 사라지고 원래 화면

- [ ] **Step 8: 커밋**

```bash
git add editor.js views.js styles.css tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 일정 카드 추가·수정·삭제와 시간순 자동 정렬"
```

---

### Task 9: 서비스워커·번들러·문서 마무리

**Files:**
- Modify: `C:\Pcall\Trip\sw.js`
- Modify: `C:\Pcall\Trip\bundle.py`
- Modify: `C:\Pcall\Trip\manifest.json`
- Modify: `C:\Pcall\Trip\docs\superpowers\specs\2026-08-04-general-travel-app-design.md`
- Delete: `C:\Pcall\Trip\osaka-trip.html` (재생성됨), `C:\Pcall\Trip\usj-map-ko.webp`

**Interfaces:**
- Consumes: 없음
- Produces: 배포 가능한 정적 자산 일습

- [ ] **Step 1: `sw.js` 자산 목록과 버전 갱신**

```js
const CACHE = "trip-v8";
const ASSETS = ["./", "./index.html", "./styles.css",
  "./sample-trip.js", "./store.js", "./schema.js", "./views.js", "./editor.js", "./app.js",
  "./manifest.json", "./icon.svg", "./icon-180.png", "./icon-512.png"];
```

나머지(install/activate/fetch 핸들러)는 그대로 둔다. `data.js`와 `usj-map-ko.webp`가 목록에서 빠지는 것이 핵심이다 — 남아 있으면 `addAll`이 404로 실패해 설치 자체가 안 된다.

- [ ] **Step 2: `bundle.py` 갱신**

`data_uri`/`usj_map` 관련 줄을 전부 지우고, 인라인할 스크립트 목록을 바꾼다:

```python
# -*- coding: utf-8 -*-
"""styles.css + 스크립트들을 index.html 구조에 인라인해
단일 자체완결형 trip.html 을 생성한다 (모바일 file:// 대응)."""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
def read(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return f.read()

SCRIPTS = ["sample-trip.js", "store.js", "schema.js", "views.js", "editor.js", "app.js"]

html = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b7285">
<meta name="color-scheme" content="light">
<title>여행 플래너</title>
<style>
""" + read("styles.css") + """
</style>
</head>
<body>
<section id="screen-list" hidden>
<header class="lhead"><h1>내 여행</h1></header>
<div id="triplist"></div>
<div class="lactions">
<button id="new-trip" type="button">+ 새 여행 만들기</button>
<button id="add-sample" type="button">샘플 여행 보기</button>
</div>
</section>
<section id="screen-trip" hidden>
<header id="summary"></header>
<nav id="daytabs"></nav>
<main id="timeline"></main>
<section id="fixed"></section>
</section>
<section id="screen-edit" hidden></section>
""" + "".join("<script>\n" + read(s) + "\n</script>\n" for s in SCRIPTS) + """</body>
</html>
"""

out = os.path.join(BASE, "trip.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", out, "(", len(html), "chars )")
```

`index.html`의 `<body>`와 구조가 일치해야 한다. Task 6에서 `index.html`을 바꿨으므로 위 구조를 그대로 복사한 것이다 — 실제 파일과 대조해 확인한다.

- [ ] **Step 3: 번들 생성과 확인**

```bash
cd /c/Pcall/Trip && python bundle.py && rm -f osaka-trip.html && git rm -f --cached osaka-trip.html usj-map-ko.webp 2>/dev/null; rm -f usj-map-ko.webp; ls -la trip.html
```

`trip.html`을 브라우저에서 `file://`로 직접 열어 목록 화면이 뜨고 "샘플 여행 보기"가 동작하는지 확인한다.

- [ ] **Step 4: `manifest.json` 이름 범용화**

```json
{
  "name": "여행 플래너",
  "short_name": "여행",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#f5f7f9",
  "theme_color": "#0b7285",
  "icons": [
    { "src": "icon-180.png", "sizes": "180x180", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

기존 파일의 `icons` 항목이 위와 다르면 **기존 것을 유지**한다. `name`/`short_name`만 바꾼다.
`index.html`의 `<title>`과 `apple-mobile-web-app-title`도 각각 `여행 플래너`, `여행`으로 바꾼다.

- [ ] **Step 5: 스펙 문서 갱신**

`docs/superpowers/specs/2026-08-04-general-travel-app-design.md`는 다국가·통화 결정 이전 버전이 커밋돼 있다(`eaaec3e`). 다음을 반영한다:

- 요구사항에 "일차별 도시·통화 지정", "앱 사용자는 한국인 전제(UI 한국어, 기준 통화 원화)" 추가
- 데이터 모델의 `days[]`에 `place`/`curCode` 오버라이드, `currency`에 `decimals` 추가
- `spend` 레코드에 `cur` 필드, 날씨 캐시 키를 좌표별(`wx:<lat>,<lon>`)로, 환율 캐시 `fx` 전역
- 환율 API를 **Frankfurter → `open.er-api.com`**으로 교체하고 이유 명시:
  Frankfurter는 ECB 기준 31개 통화라 **VND·TWD가 없다**. `open.er-api.com/v6/latest/KRW`는
  키 없이 152개 통화(VND·TWD·MOP·KHR·LAK 포함), 일 1회 갱신, 출처 표기 필요
- 2단계에 추가: 날씨 `forecast_days=16`, 지오코딩 한국어 0건 시 영어 재시도,
  소수점 통화(`decimals`) 처리, 일차 탭 자동 스크롤
- `sections`가 내장 섹션까지 포함한다는 결정 (아코디언 순서 데이터 주도)
- "하지 않는 것"에 다국어 UI 추가

- [ ] **Step 6: 전체 회귀 확인**

```bash
cd /c/Pcall/Trip && node test-node.js && python -m http.server 8000
```

DevTools에서 `localStorage.clear()` 후:

1. **샘플 회귀** — "샘플 여행 보기" → 개편 전 화면과 비교.
   D-day·제목·기간·숙소·총액, 일차 탭 7개, 1일차 항목 6개,
   아코디언 순서 라피트 → 숙소 → 준비물 → 현지 경비 → 경비 내역 → 팁,
   라피트 표 두 개(간사이→난바 / 난바→간사이), 팁 2줄, 준비물 15개.
   USJ 지도만 없다 (2단계에서 복구)
2. **경비·준비물** — 현지 경비에 1200 추가 → 상단 요약에 반영, 새로고침 후 유지.
   준비물 체크 → 유지
3. **오프라인** — DevTools Network를 Offline로 하고 새로고침 → 앱이 뜨고 편집이 동작.
   날씨 줄에 시각 스탬프
4. **다중 여행** — 새 여행을 하나 더 만들고 `#/`로 → 카드 2개.
   각각 열어 경비·준비물이 **섞이지 않는지** 확인 (여행별 키 격리)
5. **마이그레이션** — 콘솔에서 구 데이터를 심고 새로고침:
   ```js
   localStorage.clear();
   localStorage.setItem('osaka-trip:v1:spend',
     JSON.stringify([{id:1,date:'2026-07-29',jpy:1200,cat:'식비',note:'이치란'}]));
   location.reload();
   ```
   → 오사카 여행이 자동 생성되고 현지 경비에 ¥1,200이 있고, `osaka-trip:v1:*` 키가 사라짐

- [ ] **Step 7: 커밋**

```bash
git add -A
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "chore: sw v8·번들러·매니페스트를 범용 여행앱으로 갱신하고 스펙 반영"
```

---

## 1단계 완료 기준

- `node test-node.js` 전부 통과
- `localStorage`가 빈 상태에서 여행을 만들고, 일정을 추가·수정·삭제하고, 새로고침 후 유지된다
- 여행을 여러 개 만들어도 경비·준비물이 섞이지 않는다
- 오사카 샘플이 USJ 지도를 뺀 나머지 전부 개편 전과 동일하게 보인다
- 구 `osaka-trip:v1:*` 데이터가 자동 이관된다
- 일정 텍스트에 HTML을 넣어도 실행되지 않는다
- 오프라인에서 앱이 뜨고 편집이 동작한다

## 2단계로 넘기는 것

의도적으로 남긴 것들이다. 1단계 리뷰에서 "빠졌다"고 보지 말 것:

- 통화 — `¥`·`jpyToKrw`·`spendFx`가 그대로 남아 있다. `money.js`와 환율 조회는 2단계
- 날씨 좌표 — `WX_URL`의 오사카 고정. 도시 검색·좌표별 캐시·`forecast_days=16`은 2단계
- `day.place`/`day.curCode` — 스키마에는 있으나 아직 UI도 렌더도 쓰지 않는다
- USJ 지도 — 이미지 첨부(IndexedDB)로 2단계에 복구
- 사용자 정의 섹션 편집 UI — `sections`를 읽어 그리기만 한다. 편집은 2단계
- 내보내기·가져오기 — 3단계
