# 2단계-A 장소·날씨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여행마다(그리고 일차마다) 자기 도시의 날씨가 뜨게 한다. 지금은 `WX_URL`이 오사카 좌표를 고정하고 있어 다낭 여행에도 오사카 날씨가 뜬다.

**Architecture:** 1단계 최종 리뷰가 권고한 순서를 그대로 따른다 — ① 날씨 코드를 `remote.js`로 먼저 빼고(안 그러면 새 렌더 함수마다 같은 얽힘을 물려받는다) ② `wxState` 단일 전역을 좌표별 캐시로 바꾸고(가장 큰 기계적 변경, 독립 태스크) ③ 그 위에 도시 검색을 얹는다. 각 태스크 끝에서 앱은 동작한다.

**Tech Stack:** 바닐라 JS(기존 스타일), Open-Meteo 예보·지오코딩 API(키 불요), localStorage, Python(bundle.py).

## Global Constraints

- 작업 디렉터리 `C:\Pcall\Trip`. `main`이 아닌 새 브랜치에서 작업한다.
- 빌드 도구·프레임워크·npm 의존성 없음. `<script>` + 전역 함수.
- 코드 스타일은 기존 파일을 따른다 — `function` 선언, `var`/`const` 혼용, 문자열 연결로 HTML 생성. 화살표 함수·클래스·ES 모듈 금지.
- 스크립트 로드 순서: `sample-trip.js` → `store.js` → `schema.js` → **`remote.js`** → `views.js` → `editor.js` → `app.js`. `index.html`·`test.html`·`test-node.js` 세 곳 모두.
- `test-node.js`는 `files` 배열을 **최상위 `for` 루프**로 eval한다. `forEach` 금지 — 콜백 안의 직접 `eval`은 선언을 콜백 스코프에 가둔다.
- 테스트는 `node test-node.js`(정본, 실패 시 exit 1)와 `test.html`(브라우저, 개수 일치). **현재 303개 통과.**
- 이스케이프 규율: `innerHTML`에 닿는 문자열은 `escHtml`, 숫자는 `Number()`. **지오코딩 응답은 외부 입력이다** — 도시명·국가명 모두 반드시 `escHtml`.
- `saveTrip`/`saveTripBody`/`lsSet`의 성공 boolean을 버리지 않는다.
- 렌더 범위 규율: 탭 전환은 본문·내비만, 일차 전환은 일차 스트립·타임라인만.
- **통화는 이 계획의 범위가 아니다.** `¥`·`jpyToKrw`·`spendFx`는 그대로 둔다(2단계-B).
- 커밋: `git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" commit -m "..."`, 한국어, `feat:`/`fix:`/`refactor:`/`test:`/`docs:`/`chore:` 접두사.
- 브라우저 확인은 `python -m http.server 8123`. **8000번 금지.**
- **브라우저 HTTP 캐시 주의:** 이 저장소에서 `location.reload()`만으로는 수정한 스크립트가 반영되지 않는 일이 반복됐다. 확인 전 `fetch(f,{cache:'no-store'})`로 받아 `(0,eval)(t)` 하거나 하드 리로드할 것.

---

## API 실측 결과 (2026-08-06, 이 계획의 전제)

**지오코딩** `geocoding-api.open-meteo.com/v1/search?name=<q>&language=ko&count=<n>`

| 질의 | language | 결과 |
|---|---|---|
| `다낭` | ko | **0건** |
| `다낭` | en | **0건** — 폴백해도 그대로다 |
| `Da Nang` | ko | 3건, 이름 `다낭 / 베트남` (한국어 표시) |
| `오사카` | ko | 2건 (`오사카 시`, `오사카 국제공항`) |
| `방콕` | ko | 1건 |

`language`는 **표시 언어만** 바꾸고 매칭에는 관여하지 않는다. 한국어 이름은 표시용으로만 존재하며 색인 보유 여부가 도시마다 다르다. 따라서 **`language=en` 폴백을 구현하지 않는다** — 0건이면 영어·현지 이름 재검색을 안내한다.

응답 필드: `id, name, latitude, longitude, elevation, feature_code, country_code, country, timezone, admin1`(+ 선택 `population`, `admin2`). `results` 키는 **0건일 때 아예 없다** — `api.results || []`로 받아야 한다.

**예보** `api.open-meteo.com/v1/forecast?latitude=&longitude=&daily=…&timezone=&forecast_days=16`
`forecast_days` 상한은 16. 현재 7로 고정돼 있어 2주 넘는 여행은 뒷부분 날씨가 빈다.

---

### Task 1: `remote.js` 추출 (동작 변경 없음)

순수 리팩터링이다. 날씨 코드를 `app.js`에서 떼어내 `remote.js`로 옮긴다. 다음 태스크들이 이 파일 위에서 진행된다.

**Files:**
- Create: `C:\Pcall\Trip\remote.js`
- Modify: `C:\Pcall\Trip\app.js` (날씨 코드 제거)
- Modify: `index.html`, `test.html`, `test-node.js` (로드 등록)

**Interfaces:**
- Consumes: 없음 (`wxRepaint`는 `app.js`에 남아 `remote.js`가 콜백으로 받는다)
- Produces (전부 `app.js`에서 그대로 이동):
  - `WX_URL`, `WX_TTL_MS`
  - `wxIcon(code)`, `wxDailyMap(api)`, `wxLine(map, date)`
  - `wxState`, `wxReset()`, `wxIsFresh()`, `wxStamp()`
  - `wxRefresh(st)`

- [ ] **Step 1: `remote.js` 생성 — `app.js`에서 잘라내 붙인다**

`app.js` 최상단부터 `wxRefresh` 끝(`}` 포함)까지가 대상이다. 다음은 **옮기지 않는다**: `todayLocal`(라우터·뷰가 함께 쓴다), `repaintDay`, `wxRepaint`, 그 아래 라우터 전부.

`remote.js` 첫 줄에 주석을 단다:

```js
// 외부 조회 계층: 날씨(Open-Meteo 예보). 캐시 우선이고, 실패해도 앱은 동작한다.
// DOM에 손대지 않는다 — 다시 그리는 것은 호출부(app.js의 wxRepaint)의 몫이다.
// schema.js 다음, views.js 앞에 로드된다.
```

**`wxRefresh`의 `wxRepaint()` 호출 두 곳은 그대로 둔다.** `remote.js`는 `views.js`보다 먼저 로드되지만 `wxRepaint`는 호출 시점에만 참조되므로 문제없다(기존 `views.js`가 `wxLine`을 참조하는 것과 같은 구조).

`todayLocal`이 `remote.js`로 딸려가지 않았는지 확인한다 — `app.js`에 남아야 한다.

- [ ] **Step 2: 로드 순서 등록**

- `index.html`: `<script src="schema.js">` 다음 줄에 `<script src="remote.js"></script>`
- `test.html`: 같은 위치에 추가
- `test-node.js`: `files` 배열을 `["sample-trip.js", "store.js", "schema.js", "remote.js", "views.js", "editor.js", "app.js", "tests.js"]`로

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `303개 전부 통과`. **단언은 하나도 늘지 않는다** — 순수 이동이므로 기존 날씨 단언 14개가 그대로 통과해야 한다. 하나라도 실패하면 옮기다 빠뜨린 것이다.

- [ ] **Step 4: 브라우저 확인**

`python -m http.server 8123` → 샘플 여행을 열어 상단 요약에 날씨 줄(`🌤️ 오늘 …°/…°`)이 그대로 뜨는지. 콘솔 오류 0건.

- [ ] **Step 5: 커밋**

```bash
git add remote.js app.js index.html test.html test-node.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "refactor: 날씨 조회를 remote.js로 분리"
```

---

### Task 2: 좌표별 날씨 캐시

`wxState` 단일 전역을 좌표별 맵으로 바꾼다. 이 태스크만으로는 화면이 바뀌지 않는다(아직 좌표가 하나뿐이므로) — 다음 태스크의 토대다.

**Files:**
- Modify: `C:\Pcall\Trip\remote.js`
- Modify: `C:\Pcall\Trip\app.js` (`wxRepaint`가 현재 일차 좌표를 넘긴다)
- Modify: `C:\Pcall\Trip\views.js` (`wxLine(wxState.map, …)` → 좌표 인자)
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: `dayPlace` (schema.js), `tripStore` (store.js)
- Produces:
  - `wxKey(place): string` — `"<lat>,<lon>"` 소수점 3자리 반올림. `place`가 없으면 `""`
  - `wxUrl(place): string` — 좌표·시간대를 넣은 예보 URL. `forecast_days=16`
  - `wxGet(st, place): {map, at, live}` — 그 좌표의 캐시. 없으면 `{map:{}, at:null, live:false}`.
    `st`가 필요한 것은 메모리에 없을 때 저장소까지 보기 때문이다
  - `wxRefresh(st, place, onDone)` — 좌표별로 조회·캐시. 이미 신선하면 즉시 반환
  - `wxResetAll()` — 여행 전환 시 전체 비움
  - `wxLine(map, date)` — **서명 그대로**(순수 함수, 기존 단언 유지)
  - `wxStamp(place)` — 좌표별 스탬프. 메모리 캐시(`wxMem`)만 읽으므로 `st`를 받지 않는다 —
    호출부는 같은 렌더 안에서 `wxGet(st, place)`를 먼저 부르고(그때 `wxMem`이 채워진다)
    `wxStamp(place)`를 부른다. 이 순서를 지켜야 스탬프가 뜬다

**저장소 키:** `trip:<id>:wx:<lat>,<lon>` (스펙의 설계 그대로). 기존 `trip:<id>:weather` 키는 **좌표를 모르므로 이관하지 않고 버린다** — 예보는 하루면 낡는 캐시라 잃어도 손실이 없다. 다음 조회에서 새로 채워진다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests.js` 끝에 추가:

```js
// ---- 좌표별 날씨 캐시 ----
var OSAKA = { name: '오사카', lat: 34.69379, lon: 135.50107, tz: 'Asia/Tokyo' };
var DANANG = { name: '다낭', lat: 16.06778, lon: 108.22083, tz: 'Asia/Ho_Chi_Minh' };

eq('wxKey 좌표 조합', wxKey(OSAKA), '34.694,135.501');
eq('wxKey 반올림', wxKey({ lat: 1.23456, lon: 2.99999 }), '1.235,3');
eq('wxKey place 없으면 빈 문자열', wxKey(null), '');

eq('wxUrl에 좌표가 들어간다', wxUrl(DANANG).indexOf('latitude=16.06778') >= 0, true);
eq('wxUrl에 시간대가 들어간다',
  wxUrl(DANANG).indexOf('timezone=Asia%2FHo_Chi_Minh') >= 0, true);
eq('wxUrl은 16일 예보', wxUrl(OSAKA).indexOf('forecast_days=16') >= 0, true);

// 좌표가 다르면 캐시가 섞이지 않는다
(function () {
  __resetStorage();
  wxResetAll();
  var st = tripStore('t_w');
  var apiO = { daily: { time: ['2026-09-01'], weather_code: [0],
    temperature_2m_max: [30], temperature_2m_min: [20], precipitation_probability_max: [10] } };
  var apiD = { daily: { time: ['2026-09-01'], weather_code: [61],
    temperature_2m_max: [33], temperature_2m_min: [26], precipitation_probability_max: [80] } };
  st.set('wx:' + wxKey(OSAKA), { at: '2026-09-01T00:00:00Z', api: apiO });
  st.set('wx:' + wxKey(DANANG), { at: '2026-09-01T00:00:00Z', api: apiD });

  eq('오사카 캐시를 읽는다', wxLine(wxGet(st, OSAKA).map, '2026-09-01'), '☀️ 30° / 20° · 비 10%');
  eq('다낭 캐시를 읽는다', wxLine(wxGet(st, DANANG).map, '2026-09-01'), '🌧️ 33° / 26° · 비 80%');
  eq('캐시 없는 좌표는 빈 맵',
    wxGet(st, { lat: 1, lon: 1 }).map, {});
})();
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: `ReferenceError: wxKey is not defined`

- [ ] **Step 3: `remote.js` 구현**

`WX_URL` 상수를 지우고 다음으로 대체한다:

```js
var WX_DAILY = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max";
// forecast_days 상한은 16이다. 7이면 2주 넘는 여행의 뒷부분 날씨가 빈다.
var WX_DAYS = 16;

// 좌표를 캐시 키로 쓴다. 소수점 3자리(약 100m)면 같은 도시가 같은 키로 모인다.
function wxKey(place) {
  if (!place) return "";
  var la = Math.round(Number(place.lat) * 1000) / 1000;
  var lo = Math.round(Number(place.lon) * 1000) / 1000;
  if (!isFinite(la) || !isFinite(lo)) return "";
  return la + "," + lo;
}

function wxUrl(place) {
  return "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + Number(place.lat) + "&longitude=" + Number(place.lon) +
    "&daily=" + WX_DAILY +
    "&timezone=" + encodeURIComponent(place.tz || "auto") +
    "&forecast_days=" + WX_DAYS;
}
```

`wxState` 전역을 좌표별 맵으로 바꾼다:

```js
// 좌표별 예보 캐시. 여행 하나가 여러 도시를 지날 수 있으므로 단일 전역으로는 안 된다.
var wxMem = {};

function wxResetAll() { wxMem = {}; }

// 메모리 캐시 → 저장소 캐시 순으로 찾는다. 둘 다 없으면 빈 맵(화면에서 날씨 줄이 사라진다).
function wxGet(st, place) {
  var k = wxKey(place);
  if (!k) return { map: {}, at: null, live: false };
  if (wxMem[k]) return wxMem[k];
  var cached = st ? st.get("wx:" + k, null) : null;
  if (cached && cached.api) {
    wxMem[k] = { map: wxDailyMap(cached.api), at: cached.at, live: false, fetchedAt: 0 };
    return wxMem[k];
  }
  return { map: {}, at: null, live: false };
}
```

`wxIsFresh`·`wxStamp`·`wxRefresh`를 좌표 인자를 받도록 고친다. `wxRefresh(st, place, onDone)`는 신선하면 즉시 반환하고, 아니면 `fetch(wxUrl(place))` 후 `wxMem[k]`와 저장소를 채우고 `onDone()`을 부른다. 실패해도 캐시가 있으면 `onDone()`을 부른다(스탬프 표시가 갱신돼야 한다).

**`wxRefresh`가 `wxRepaint`를 직접 부르지 않게 한다** — `onDone` 콜백으로 뒤집는다. `remote.js`가 렌더를 모르는 편이 층이 깔끔하고, 1단계 리뷰가 지적한 역방향 의존을 여기서 끊는다.

**진행 중 요청과 여행 전환의 경쟁(1단계 리뷰 Minor):** `wxResetAll()`이 진행 중 fetch를 취소하지 못한다. 세대 카운터를 두고 `.then` 안에서 확인해 낡은 응답을 버린다:

```js
var wxGen = 0;
function wxResetAll() { wxMem = {}; wxGen++; }
// wxRefresh 안에서: var gen = wxGen; … .then(function(api){ if (gen !== wxGen) return; … })
```

- [ ] **Step 4: 호출부 수정**

`app.js`:
- `wxRepaint`가 현재 일차의 좌표로 캐시를 읽어 넘긴다
- `showTrip`의 `wxRefresh(CUR.st)` → `wxRefresh(CUR.st, dayPlace(trip, 현재일차), wxRepaint)`
- `switched`일 때 `wxReset()` → `wxResetAll()`

`views.js`:
- `renderSummary`·`renderTimeline`의 `wxLine(wxState.map, …)` → `wxLine(wxGet(st, dayPlace(trip, day)).map, …)`
- `wxStamp()` → `wxStamp(dayPlace(trip, day))`
- **`place`가 없으면(새 여행) 날씨 줄 자체가 사라진다** — 기존 "예보 없는 날짜는 줄을 생략" 규칙과 같은 처리다. 오류 문구를 넣지 않는다

- [ ] **Step 5: 통과 확인과 브라우저 확인**

```bash
cd /c/Pcall/Trip && node test-node.js
```
Expected: 실패 0.

브라우저: 샘플 여행(오사카, `place` 있음)은 날씨가 그대로. 새로 만든 여행(`place: null`)은 **날씨 줄이 없다** — 다음 태스크에서 도시를 지정하면 생긴다.

- [ ] **Step 6: 커밋**

```bash
git add remote.js app.js views.js tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 날씨 캐시를 좌표별로 분리하고 16일 예보로 확장"
```

---

### Task 3: 도시 검색

**Files:**
- Modify: `C:\Pcall\Trip\remote.js` (지오코딩)
- Modify: `C:\Pcall\Trip\editor.js` (여행 설정에 도시 검색)
- Modify: `C:\Pcall\Trip\styles.css`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Produces:
  - `geoUrl(q, count): string`
  - `geoParse(api): Array<{name, country, lat, lon, tz}>` — 순수. `results` 없으면 `[]`
  - `geoSearch(q, cb)` — `cb(list, err)`. 실패 시 `cb([], '문구')`
  - `placeLabel(place): string` — `"다낭 · 베트남"`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// ---- 도시 검색 ----
eq('geoUrl 질의 인코딩', geoUrl('Da Nang', 5).indexOf('name=Da%20Nang') >= 0, true);
eq('geoUrl은 한국어 표시', geoUrl('Da Nang', 5).indexOf('language=ko') >= 0, true);
// language=en 폴백은 쓰지 않는다 — 표시 언어만 바뀌고 매칭에는 관여하지 않는다(실측).
eq('geoUrl에 en 폴백 흔적 없음', geoUrl('x', 5).indexOf('language=en') === -1, true);

var GEOAPI = { results: [
  { name: '다낭', country: '베트남', latitude: 16.06778, longitude: 108.22083,
    timezone: 'Asia/Ho_Chi_Minh', admin1: 'Da Nang City' },
  { name: '다낭 국제공항', country: '베트남', latitude: 16.04392, longitude: 108.19937,
    timezone: 'Asia/Ho_Chi_Minh', admin1: 'Da Nang City' }
] };
eq('geoParse 변환', geoParse(GEOAPI)[0],
  { name: '다낭', country: '베트남', lat: 16.06778, lon: 108.22083, tz: 'Asia/Ho_Chi_Minh' });
eq('geoParse 개수', geoParse(GEOAPI).length, 2);
// 0건일 때 응답에는 results 키 자체가 없다(실측) — 빈 배열로 받아야 한다.
eq('geoParse 0건 응답', geoParse({ generationtime_ms: 0.1 }), []);
eq('geoParse null 응답', geoParse(null), []);

eq('placeLabel 조합', placeLabel({ name: '다낭', country: '베트남' }), '다낭 · 베트남');
eq('placeLabel 국가 없으면 이름만', placeLabel({ name: '다낭' }), '다낭');
eq('placeLabel 없으면 빈 문자열', placeLabel(null), '');
```

- [ ] **Step 2: 실패 확인 → Step 3: `remote.js` 구현**

```js
// 지오코딩. language는 결과의 표시 언어만 바꾸고 검색어 매칭에는 관여하지 않는다 —
// '다낭'은 ko/en 어느 쪽으로도 0건이고, 'Da Nang'을 ko로 조회해야 '다낭/베트남'이
// 나온다(2026-08-06 실측). 그래서 en 폴백을 두지 않고, 0건이면 영어·현지 이름으로
// 다시 찾도록 화면에서 안내한다.
function geoUrl(q, count) {
  return "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(q) + "&language=ko&count=" + (count || 5);
}

// 0건이면 응답에 results 키가 아예 없다.
function geoParse(api) {
  var rows = (api && api.results) || [];
  return rows.map(function (r) {
    return { name: r.name, country: r.country,
             lat: r.latitude, lon: r.longitude, tz: r.timezone };
  });
}

function placeLabel(place) {
  if (!place || !place.name) return "";
  return place.country ? place.name + " · " + place.country : place.name;
}
```

`geoSearch(q, cb)`는 `fetch(geoUrl(q, 5))` → `geoParse` → `cb(list, null)`. 네트워크 실패는 `cb([], '검색에 실패했습니다. 연결을 확인해 주세요.')`.

- [ ] **Step 4: `editor.js` 여행 설정에 도시 검색 UI**

숙소 입력 아래에 넣는다. 상태는 폼 제출 시 `applyTripForm`으로 넘긴다.

- 현재 도시 표시: `placeLabel(trip.place)` 또는 `도시가 지정되지 않았습니다`
- 검색 입력 + `찾기` 버튼 (form 안의 `<input type="text">`는 Enter로 상위 폼이 제출되므로 **버튼 `type="button"`으로 두고 Enter는 `keydown`에서 가로채 검색**한다)
- 결과 목록: 각 항목에 `placeLabel`, 클릭하면 선택되고 목록이 닫힌다
- **0건이면**: `결과가 없습니다. 영어나 현지 이름으로 검색해 보세요 (예: 다낭 → Da Nang)`
- 검색 중에는 `찾기` 버튼을 비활성화한다(연타 방지)
- 선택한 도시는 **저장 버튼을 눌러야 반영된다** — 취소하면 원래대로. `applyTripForm`이 비변형이라는 계약을 지킨다

`applyTripForm(trip, f)`에 `f.place`를 받아 `next.place = f.place`로 넣는다. `f.place`가 `undefined`면 기존 값을 유지한다(도시를 안 건드린 저장).

**이스케이프:** 도시명·국가명은 외부 입력이다. 결과 목록과 현재 도시 표시 모두 `escHtml`을 거친다. 악의적인 이름이 들어와도 글자로만 보여야 한다.

- [ ] **Step 5: 스타일**

```css
.geo-row { display:flex; gap:8px; }
.geo-row input { flex:1; }
.geo-row button { font:inherit; padding:10px 14px; border:1px solid #d5dde1;
  border-radius:10px; background:var(--card); cursor:pointer; }
.geo-list { list-style:none; margin:8px 0 0; padding:0; border:1px solid #d5dde1;
  border-radius:10px; overflow:hidden; }
.geo-list li { padding:10px 12px; cursor:pointer; border-bottom:1px solid #eef2f4; }
.geo-list li:last-child { border-bottom:0; }
.geo-list li:hover { background:#f1f5f7; }
.geo-msg { font-size:.85rem; color:var(--muted); margin-top:6px; }
.geo-cur { font-size:.9rem; color:var(--text); }
```

- [ ] **Step 6: 통과 확인과 브라우저 확인**

`node test-node.js` 실패 0. 브라우저에서:
1. 새 여행 → ⚙ → `Da Nang` 검색 → `다낭 · 베트남` 선택 → 저장 → **날씨 줄이 생긴다**
2. `다낭` 검색 → 0건 안내가 뜨고 영어 재검색을 권한다
3. 검색 후 저장 안 하고 뒤로 → 도시가 반영되지 않는다
4. 도시명에 HTML을 넣은 응답을 흉내내도 글자로만 보인다

- [ ] **Step 7: 커밋**

```bash
git add remote.js editor.js styles.css tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 도시 검색으로 여행 좌표 지정"
```

---

### Task 4: 일차별 도시 오버라이드

**Files:**
- Modify: `C:\Pcall\Trip\editor.js` (일차별 도시 지정 UI)
- Modify: `C:\Pcall\Trip\views.js` (일차 헤더에 도시 배지)
- Modify: `C:\Pcall\Trip\styles.css`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Consumes: `dayPlace` (schema.js, 이미 있고 테스트돼 있다), `geoSearch`, `placeLabel`
- Produces:
  - `setDayPlace(trip, dayN, place): Trip` — 순수. `place`가 `null`이면 상속으로 되돌린다

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// ---- 일차별 도시 ----
(function () {
  var trip = { place: { name: '하노이', lat: 21, lon: 105, tz: 'Asia/Bangkok' },
    days: [{ n: 1, place: null }, { n: 2, place: null }] };
  var P = { name: '다낭', country: '베트남', lat: 16.06778, lon: 108.22083, tz: 'Asia/Ho_Chi_Minh' };

  setDayPlace(trip, 2, P);
  eq('일차 도시 지정', trip.days[1].place.name, '다낭');
  eq('지정 안 한 일차는 여행 기본값 상속', dayPlace(trip, trip.days[0]).name, '하노이');
  eq('지정한 일차는 그 도시', dayPlace(trip, trip.days[1]).name, '다낭');

  setDayPlace(trip, 2, null);
  eq('null이면 상속으로 되돌아감', trip.days[1].place, null);
  eq('되돌린 뒤 상속 확인', dayPlace(trip, trip.days[1]).name, '하노이');

  eq('없는 일차는 무해', setDayPlace(trip, 99, P).days.length, 2);
})();
```

- [ ] **Step 2~3: 구현**

`setDayPlace`는 `editor.js`의 항목 CRUD 옆에 둔다(`addItem`/`updateItem`과 같은 계층).

여행 설정 화면에 일차 목록을 두고, 각 일차에 현재 적용 도시(`dayPlace` 결과)와 `변경`/`기본값으로` 버튼을 놓는다. 검색 UI는 Task 3의 것을 재사용한다.

`views.js`의 일차 헤더(`.dayhead`)에 **여행 기본값과 다른 일차에만** 도시 배지를 붙인다 — 모든 일차에 붙이면 단일 도시 여행에서 소음이 된다.

```js
// 여행 기본 도시와 다른 일차에만 배지를 붙인다.
var dp = dayPlace(trip, day);
var badge = (dp && trip.place && wxKey(dp) !== wxKey(trip.place))
  ? '<span class="daycity">📍 ' + escHtml(dp.name) + '</span>' : '';
```

- [ ] **Step 4: 통과 확인과 브라우저 확인**

브라우저에서 하노이 여행을 만들고 3일차만 다낭으로 지정 → 3일차 탭에서 날씨가 바뀌고 배지가 뜨는지, 나머지 일차는 그대로인지. **날씨 요청이 좌표당 한 번씩만 나가는지**(네트워크 패널 또는 `fetch` 래퍼로 확인).

- [ ] **Step 5: 커밋**

```bash
git add editor.js views.js styles.css tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 일차별 도시 지정과 그 일차 날씨"
```

---

### Task 5: 서비스워커·번들러·회귀

- [ ] **Step 1: `sw.js`** — `ASSETS`에 `"./remote.js"` 추가, `CACHE`를 `"trip-v10"`으로.
- [ ] **Step 2: `bundle.py`** — `SCRIPTS`에 `"remote.js"`를 `schema.js`와 `views.js` 사이에 넣는다. `python bundle.py` 후 확인:

```bash
cd /c/Pcall/Trip && python bundle.py && node -e "
var h=require('fs').readFileSync('trip.html','utf8');
console.log('remote 포함:', h.indexOf('function wxKey')>=0);
console.log('geo 포함:', h.indexOf('function geoParse')>=0);
console.log('scripts:', h.split('<script>').length-1);
"
```
Expected: 둘 다 `true`, `scripts: 7`

- [ ] **Step 3: 회귀** — `python -m http.server 8123`. 각 항목에서 본 것을 보고한다.

1. **오사카 회귀** — 샘플 여행의 날씨·일차·탭·경비가 개편 전과 동일
2. **다낭 시나리오** — 새 여행 → `Da Nang` 검색·선택 → 날씨가 다낭 것으로. 오사카 여행을 다시 열어도 오사카 날씨(캐시 안 섞임)
3. **다국가** — 하노이 여행에 3일차만 다낭 → 그 일차만 날씨·배지가 다름
4. **0건 안내** — `다낭` 한국어 검색 시 영어 재검색 안내
5. **도시 없는 여행** — 도시를 지정하지 않은 새 여행에서 날씨 줄이 없고, 아무 탭도 예외를 던지지 않음
6. **오프라인** — Offline 후 재로드. 앱이 뜨고 캐시된 날씨에 시각 스탬프
7. **XSS** — 일정·숙소·도시명에 `<img src=x onerror=alert(1)>` → 글자로만
8. **긴 여행** — 20일 여행을 만들어 16일차까지 날씨가 있고 17일차부터는 줄이 없는지

- [ ] **Step 4: 커밋**

```bash
git add -A
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "chore: sw v10과 번들러에 remote.js 반영"
```

---

## 완료 기준

- `node test-node.js` 전부 통과, `test.html`도 같은 개수
- 여행마다 자기 도시 날씨가 뜨고, 여행을 오가도 캐시가 섞이지 않는다
- 일차별로 도시를 지정하면 그 일차만 날씨가 바뀐다
- 도시가 없는 여행은 날씨 줄만 사라질 뿐 아무 것도 깨지지 않는다
- 한국어로 0건일 때 영어 재검색을 안내한다
- `WX_URL`의 오사카 좌표 하드코딩이 사라졌다

## 이 계획의 범위가 아닌 것

- **통화·환율** (2단계-B) — `¥`·`jpyToKrw`·`spendFx`·`spend` 레코드 마이그레이션. 1단계 리뷰가 "사용자가 경비를 기록할수록 비싸진다"고 했으므로 **이 계획 직후에 착수한다**
- 사용자 정의 섹션 편집기 (2단계-C, 정보 탭에 붙는다)
- 일차별 이미지 첨부 (2단계-D)
- `views.js`가 `CUR`을 읽는 구조 정리 — 이 계획은 `wxState` 역방향 의존만 끊는다
- 내보내기·가져오기 (3단계)
