# 오사카 여행 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오사카 여행 일정을 여행 중 모바일에서 오프라인으로 빠르게 확인하는 단일 페이지 대시보드(PWA)를 만든다.

**Architecture:** 정적 자체완결형 웹앱. `data.js`(여행 데이터 객체) + `index.html`(구조) + `app.js`(렌더/저장 로직) + `styles.css`. 데이터는 `<script src>`로 로드해 `file://`에서도 동작(fetch CORS 회피). PWA(manifest + service worker)로 홈화면 추가·오프라인 캐싱.

**Tech Stack:** Vanilla HTML/CSS/JS, localStorage, Service Worker. 빌드 도구·프레임워크·외부 CDN 없음. 데이터 생성 시 Python + openpyxl(1회성).

## Global Constraints

- 프로젝트 루트: `C:\Pcall\Trip`
- 외부 네트워크 의존 금지 (CDN/폰트/이미지 원격 로드 없음). 오프라인에서 완전 동작.
- 모바일 세로(390px) 우선. 가로 스크롤 발생 금지(표/시간표는 자체 컨테이너 내 스크롤).
- 편집 데이터(준비물 체크, 식당 메모)는 localStorage에만 저장. 서버/동기화 없음.
- 데이터 원본: `C:\Pcall\오사카 여행일정.xlsx` (시트: 여행일정, 라피트 시간표, 여행경비).
- 언어: 한국어 UI.
- `file://`로 직접 열어도 렌더돼야 함(모든 로컬 참조는 상대경로, 데이터는 script 태그 로드).

---

## File Structure

- `C:\Pcall\Trip\index.html` — 마크업 뼈대, 섹션 컨테이너, 스크립트/스타일 링크
- `C:\Pcall\Trip\data.js` — `window.TRIP = {...}` 여행 데이터 (xlsx에서 생성, 손대지 않음)
- `C:\Pcall\Trip\app.js` — 렌더링(요약/탭/타임라인/고정정보) + localStorage 편집
- `C:\Pcall\Trip\styles.css` — 모바일 우선 스타일
- `C:\Pcall\Trip\manifest.json` — PWA 매니페스트
- `C:\Pcall\Trip\sw.js` — 서비스워커(정적 자산 캐싱)
- `C:\Pcall\Trip\icon.svg` — 앱 아이콘
- `C:\Pcall\Trip\gen_data.py` — data.js 생성 스크립트(1회성, 재현용)

**검증 방식:** 프레임워크 테스트 대신, 각 태스크 끝에 Node로 렌더 로직을 확인하거나(순수 함수) 브라우저 육안 확인 체크포인트를 둔다. 순수 함수(데이터 변환)는 Node 단위 검증, DOM/스타일은 브라우저 확인.

---

### Task 1: 프로젝트 스캐폴드 + data.js 생성

**Files:**
- Create: `C:\Pcall\Trip\gen_data.py`
- Create: `C:\Pcall\Trip\data.js` (스크립트 출력)

**Interfaces:**
- Produces: 전역 `window.TRIP` 객체.
  - `TRIP.meta`: `{title, start, end, nights:6, days:7, hotel, totalCostKRW:2612367}`
  - `TRIP.days`: `[{n:int, date:"YYYY-MM-DD", dow:"화", theme:string, items:[{time:"08:00", text:string}]}]` (7개)
  - `TRIP.rapit`: `{to:[{type,dep,arr}], from:[{type,dep,arr}]}` (간사이→난바 / 난바→간사이)
  - `TRIP.packing`: `string[]`
  - `TRIP.expenses`: `[{date, cat, detail, pay, krw:number, note}]`
  - `TRIP.tips`: `string[]`

- [ ] **Step 1: 생성 스크립트 작성** — `C:\Pcall\Trip\gen_data.py`

```python
# -*- coding: utf-8 -*-
"""오사카 여행일정.xlsx -> data.js 생성 (1회성, 재현 가능)."""
import openpyxl, json, os

SRC = r"C:\Pcall\오사카 여행일정.xlsx"
OUT = r"C:\Pcall\Trip\data.js"

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["여행일정"]
grid = [[("" if c is None else str(c)) for c in row] for row in ws.iter_rows(values_only=True)]

day_meta = {1:("2026-07-28","화"),2:("2026-07-29","수"),3:("2026-07-30","목"),
            4:("2026-07-31","금"),5:("2026-08-01","토"),6:("2026-08-02","일"),7:("2026-08-03","월")}
times = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00",
         "16:00","17:00","18:00","19:00","20:00","21:00"]

days = []
for d in range(1, 8):
    col = d + 1                      # xlsx col index: day1 -> 2 ... day7 -> 8
    theme = grid[3][col].strip()     # 비고 행
    items = []
    for ti, t in enumerate(times):
        r = 5 + ti                   # 08:00 행부터
        val = grid[r][col].strip() if col < len(grid[r]) else ""
        if val:
            items.append({"time": t, "text": val})
    days.append({"n": d, "date": day_meta[d][0], "dow": day_meta[d][1],
                 "theme": theme, "items": items})

# 라피트 시간표 (수기 매핑: 시트가 좌=간사이출발, 우=난바출발)
rapit = {
    "to": [   # 간사이 -> 난바
        {"type":"특급 라피트 α","dep":"13:05","arr":"13:43"},
        {"type":"특급 라피트 β","dep":"13:35","arr":"14:14"},
        {"type":"특급 라피트 α","dep":"14:05","arr":"14:43"},
    ],
    "from": [ # 난바 -> 간사이
        {"type":"특급 라피트 α","dep":"10:05","arr":"10:41"},
        {"type":"특급 라피트 β","dep":"10:35","arr":"11:15"},
        {"type":"특급 라피트 α","dep":"11:05","arr":"11:41"},
    ],
}

expenses = [
    {"date":"", "cat":"항공권", "detail":"왕복", "pay":"신한카드", "krw":766640, "note":""},
    {"date":"", "cat":"숙소", "detail":"6박", "pay":"신한카드", "krw":751232, "note":""},
    {"date":"2026-06-21","cat":"유니버셜 스튜디오 티켓","detail":"입장권(2인)","pay":"네이버페이","krw":186000,"note":""},
    {"date":"","cat":"유니버셜 스튜디오 티켓","detail":"패스권(2인)","pay":"","krw":540689,"note":""},
    {"date":"2026-06-22","cat":"버스투어","detail":"교토버스투어(2인)","pay":"신한카드","krw":61239,"note":""},
    {"date":"2026-06-24","cat":"버스투어","detail":"나라/고베버스투어(2인)","pay":"신한카드","krw":77900,"note":""},
    {"date":"2026-07-05","cat":"가이유칸 수족관","detail":"입장권(2인)","pay":"신한카드","krw":60678,"note":""},
    {"date":"2026-07-26","cat":"오사카 주유패스","detail":"2일권 2인","pay":"신한카드","krw":89772,"note":""},
    {"date":"2026-07-26","cat":"e-sim","detail":"7일 2기가 1인","pay":"신한카드","krw":12011,"note":"승유니 이심"},
    {"date":"2026-07-26","cat":"여행자보험","detail":"2인","pay":"카카오페이","krw":13230,"note":""},
    {"date":"2026-07-26","cat":"라피트","detail":"편도(간사이→난바)","pay":"신한카드","krw":26488,"note":""},
    {"date":"2026-07-27","cat":"라피트","detail":"편도(난바→간사이)","pay":"신한카드","krw":26488,"note":""},
]
total = sum(e["krw"] for e in expenses)  # = 2612367

data = {
    "meta": {
        "title":"오사카 여행", "start":"2026-07-28", "end":"2026-08-03",
        "nights":6, "days":7,
        "hotel":"포포인츠 플렉스 바이 쉐라톤 오사카 신사이바시 (체크인 15시 · 체크아웃 11시)",
        "totalCostKRW": total,
    },
    "days": days,
    "rapit": rapit,
    "packing": ["우양산","모자","선글라스","손선풍기","편한 신발 또는 샌들","동전"],
    "expenses": expenses,
    "tips": [
        "5500엔 이상 구매 시 면세: 제품·영수증·여권 들고 입구 근처 면세 카운터에서 현금 반환 (14:00~폐장 1시간 전)",
        "준비물: 우양산, 모자, 선글라스, 손선풍기, 편한 신발/샌들, 동전",
    ],
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.TRIP = ")
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(";\n")
print("wrote", OUT, "total", total)
```

- [ ] **Step 2: 생성 실행**

Run: `cd /c/Pcall/Trip && python gen_data.py`
Expected: `wrote C:\Pcall\Trip\data.js total 2612367`

- [ ] **Step 3: 산출물 검증 (Node)**

Run: `cd /c/Pcall/Trip && node -e "global.window={}; require('./data.js'); const T=window.TRIP; console.log(T.days.length, T.days.map(d=>d.items.length).join(','), T.meta.totalCostKRW)"`
Expected: `7 6,10,5,5,5,4,4 2612367`

- [ ] **Step 4: Commit** (git 저장소일 때만; 아니면 건너뜀)

```bash
git add Trip/gen_data.py Trip/data.js && git commit -m "feat: generate osaka trip data from xlsx"
```

---

### Task 2: HTML 뼈대 + 요약 헤더 렌더

**Files:**
- Create: `C:\Pcall\Trip\index.html`
- Create: `C:\Pcall\Trip\app.js`
- Create: `C:\Pcall\Trip\styles.css`

**Interfaces:**
- Consumes: `window.TRIP.meta`.
- Produces: `app.js` 전역 함수 `dday(todayISO, startISO, endISO)` → 문자열("D-3" / "여행 중 N일차" / "여행 종료"); `renderSummary(meta)` → `#summary`에 DOM 삽입.

- [ ] **Step 1: index.html 뼈대 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b7285">
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="styles.css">
  <title>오사카 여행</title>
</head>
<body>
  <header id="summary"></header>
  <nav id="daytabs"></nav>
  <main id="timeline"></main>
  <section id="fixed"></section>
  <script src="data.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: dday 순수 함수 + 검증 테스트 파일 작성** — `C:\Pcall\Trip\app.js` 상단에 함수 정의

```javascript
function dday(todayISO, startISO, endISO) {
  const day = 86400000;
  const t = Date.parse(todayISO + "T00:00:00");
  const s = Date.parse(startISO + "T00:00:00");
  const e = Date.parse(endISO + "T00:00:00");
  if (t < s) return "D-" + Math.round((s - t) / day);
  if (t > e) return "여행 종료";
  return "여행 중 " + (Math.round((t - s) / day) + 1) + "일차";
}
```

- [ ] **Step 3: dday 검증 (Node)**

Run: `cd /c/Pcall/Trip && node -e "$(sed -n '/function dday/,/^}/p' app.js); console.log(dday('2026-07-25','2026-07-28','2026-08-03'), '|', dday('2026-07-30','2026-07-28','2026-08-03'), '|', dday('2026-08-05','2026-07-28','2026-08-03'))"`
Expected: `D-3 | 여행 중 3일차 | 여행 종료`

- [ ] **Step 4: renderSummary 작성 + 부트스트랩** — `app.js`에 추가

```javascript
function renderSummary(meta) {
  const today = new Date().toISOString().slice(0, 10);
  const el = document.getElementById("summary");
  el.innerHTML =
    '<div class="dday">' + dday(today, meta.start, meta.end) + '</div>' +
    '<h1>' + meta.title + '</h1>' +
    '<div class="period">' + meta.start + ' ~ ' + meta.end +
      ' · ' + meta.nights + '박 ' + meta.days + '일</div>' +
    '<div class="hotel">🏨 ' + meta.hotel + '</div>' +
    '<div class="cost">💰 총 ' + meta.totalCostKRW.toLocaleString('ko-KR') + '원 (2인)</div>';
}
document.addEventListener("DOMContentLoaded", function () {
  renderSummary(window.TRIP.meta);
});
```

- [ ] **Step 5: 최소 스타일 작성** — `C:\Pcall\Trip\styles.css`

```css
:root { --bg:#f5f7f9; --card:#fff; --accent:#0b7285; --accent2:#e8590c; --text:#1a2226; --muted:#6b7780; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text);
  font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif; line-height:1.5; }
#summary { background:var(--accent); color:#fff; padding:20px 16px; }
#summary h1 { margin:4px 0; font-size:1.5rem; }
#summary .dday { font-weight:700; opacity:.9; }
#summary .period,#summary .hotel,#summary .cost { font-size:.9rem; opacity:.95; margin-top:2px; }
```

- [ ] **Step 6: 브라우저 육안 확인**

Run: `start "" "C:\Pcall\Trip\index.html"` (PowerShell) 또는 파일을 브라우저로 열기.
Expected: 상단 청록 헤더에 D-day, "오사카 여행", 기간(2026-07-28 ~ 2026-08-03 · 6박 7일), 숙소, 총 2,612,367원(2인)이 표시된다.

- [ ] **Step 7: Commit**

```bash
git add Trip/index.html Trip/app.js Trip/styles.css && git commit -m "feat: summary header + dday"
```

---

### Task 3: 날짜 탭 + 일차별 타임라인 렌더

**Files:**
- Modify: `C:\Pcall\Trip\app.js`
- Modify: `C:\Pcall\Trip\styles.css`

**Interfaces:**
- Consumes: `window.TRIP.days`, `dday` 로직에서의 오늘 판정.
- Produces: `renderTabs(days, selectedN)`, `renderTimeline(day)`, `isUndecided(text)`(불린), `selectDay(n)` 전역 함수. 활성 탭 상태는 `data-selected` 속성으로.

- [ ] **Step 1: isUndecided 순수 함수 + 검증**

```javascript
function isUndecided(text) {
  return /뭐먹지|\?$/.test(text.trim()) || text.trim() === "";
}
```

Run: `cd /c/Pcall/Trip && node -e "$(sed -n '/function isUndecided/,/^}/p' app.js); console.log(isUndecided('도톤보리 저녁 뭐먹지'), isUndecided('08:00 유니버셜 입장'))"`
Expected: `true false`

- [ ] **Step 2: renderTabs 작성** — `app.js`에 추가

```javascript
function renderTabs(days, selectedN) {
  const nav = document.getElementById("daytabs");
  nav.innerHTML = days.map(function (d) {
    const on = d.n === selectedN ? ' data-selected="1"' : '';
    return '<button class="tab"' + on + ' data-n="' + d.n + '">' +
      '<span class="tn">' + d.n + '일차</span>' +
      '<span class="td">' + d.date.slice(5) + '(' + d.dow + ')</span></button>';
  }).join('');
  nav.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { selectDay(parseInt(b.dataset.n, 10)); });
  });
}
```

- [ ] **Step 3: renderTimeline + selectDay 작성** — `app.js`에 추가

```javascript
function renderTimeline(day) {
  const main = document.getElementById("timeline");
  const rows = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    const lines = it.text.split('\n').map(function (l) {
      return '<div class="line">' + l + '</div>';
    }).join('');
    return '<div class="slot' + cls + '"><div class="time">' + it.time +
      '</div><div class="what">' + lines + '</div></div>';
  }).join('');
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + day.n + '일차</span> ' +
      '<span class="ddate">' + day.date + '(' + day.dow + ')</span>' +
      '<div class="dtheme">' + day.theme.replace(/\n/g, ' · ') + '</div></div>' +
      '<div class="slots">' + rows + '</div></div>';
}
function selectDay(n) {
  const days = window.TRIP.days;
  const day = days.find(function (d) { return d.n === n; });
  renderTabs(days, n);
  renderTimeline(day);
}
```

- [ ] **Step 4: 부트스트랩에 오늘 기준 초기 선택 연결** — `DOMContentLoaded` 핸들러에 추가

```javascript
  const days = window.TRIP.days;
  const today = new Date().toISOString().slice(0, 10);
  let initial = days.find(function (d) { return d.date === today; });
  if (!initial) initial = today < days[0].date ? days[0] : days[days.length - 1];
  selectDay(initial.n);
```

- [ ] **Step 5: 탭/타임라인 스타일 작성** — `styles.css`에 추가

```css
#daytabs { display:flex; gap:6px; overflow-x:auto; padding:10px 12px;
  position:sticky; top:0; background:var(--bg); z-index:5; -webkit-overflow-scrolling:touch; }
.tab { flex:0 0 auto; border:1px solid #d5dde1; background:var(--card); border-radius:12px;
  padding:6px 12px; display:flex; flex-direction:column; align-items:center; font:inherit; color:var(--muted); }
.tab[data-selected] { background:var(--accent); color:#fff; border-color:var(--accent); }
.tab .tn { font-weight:700; font-size:.85rem; }
.tab .td { font-size:.7rem; }
.daycard { background:var(--card); margin:12px; border-radius:14px; overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.06); }
.dayhead { padding:14px 16px; border-bottom:1px solid #eef2f4; }
.dayhead .dnum { font-weight:700; color:var(--accent); }
.dayhead .dtheme { color:var(--muted); font-size:.85rem; margin-top:3px; }
.slot { display:flex; gap:10px; padding:12px 16px; border-bottom:1px solid #f0f3f5; }
.slot:last-child { border-bottom:0; }
.slot .time { flex:0 0 46px; font-weight:700; color:var(--accent); font-size:.85rem; }
.slot .what .line { font-size:.9rem; }
.slot.undecided { background:#fff4e6; }
.slot.undecided .time { color:var(--accent2); }
```

- [ ] **Step 6: 브라우저 확인**

브라우저 새로고침.
Expected: 1~7일차 탭이 가로로 보이고, 탭 클릭 시 해당 일차 타임라인이 시간대별로 렌더됨. "뭐먹지" 항목은 주황 배경으로 강조. 오늘(2026-07-26)은 여행 전이므로 1일차가 초기 선택.

- [ ] **Step 7: Commit**

```bash
git add Trip/app.js Trip/styles.css && git commit -m "feat: day tabs and timeline"
```

---

### Task 4: 고정 정보 아코디언 (라피트/숙소/경비/팁)

**Files:**
- Modify: `C:\Pcall\Trip\app.js`
- Modify: `C:\Pcall\Trip\styles.css`

**Interfaces:**
- Consumes: `window.TRIP.rapit`, `.expenses`, `.tips`, `.meta.hotel`, `.meta.totalCostKRW`.
- Produces: `renderFixed(trip)` — `#fixed`에 `<details>` 아코디언 삽입. (준비물은 Task 5에서 채워지는 `#packing-body` 컨테이너만 여기서 생성.)

- [ ] **Step 1: renderFixed 작성** — `app.js`에 추가

```javascript
function renderFixed(trip) {
  const rapitRows = function (arr) {
    return arr.map(function (r) {
      return '<tr><td>' + r.type + '</td><td>' + r.dep + '</td><td>' + r.arr + '</td></tr>';
    }).join('');
  };
  const expRows = trip.expenses.map(function (e) {
    return '<tr><td>' + e.cat + '</td><td>' + e.detail + '</td>' +
      '<td class="num">' + e.krw.toLocaleString('ko-KR') + '</td></tr>';
  }).join('');
  const tips = trip.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('');
  document.getElementById("fixed").innerHTML =
    '<details open><summary>🚄 라피트 시간표</summary><div class="acc">' +
      '<div class="tblwrap"><table><caption>간사이 → 난바</caption>' +
      '<thead><tr><th>편</th><th>출발</th><th>도착</th></tr></thead><tbody>' +
      rapitRows(trip.rapit.to) + '</tbody></table></div>' +
      '<div class="tblwrap"><table><caption>난바 → 간사이</caption>' +
      '<thead><tr><th>편</th><th>출발</th><th>도착</th></tr></thead><tbody>' +
      rapitRows(trip.rapit.from) + '</tbody></table></div></div></details>' +
    '<details><summary>🏨 숙소</summary><div class="acc">' + trip.meta.hotel + '</div></details>' +
    '<details><summary>🎒 준비물</summary><div class="acc" id="packing-body"></div></details>' +
    '<details><summary>💰 경비 내역</summary><div class="acc"><div class="tblwrap"><table>' +
      '<thead><tr><th>항목</th><th>상세</th><th class="num">금액(원)</th></tr></thead><tbody>' +
      expRows + '</tbody><tfoot><tr><td colspan="2">합계</td><td class="num">' +
      trip.meta.totalCostKRW.toLocaleString('ko-KR') + '</td></tr></tfoot>' +
      '</table></div></div></details>' +
    '<details><summary>💡 팁</summary><div class="acc"><ul>' + tips + '</ul></div></details>';
}
```

- [ ] **Step 2: 부트스트랩에 연결** — `DOMContentLoaded` 핸들러에 `renderFixed(window.TRIP);` 추가 (selectDay 호출 뒤)

- [ ] **Step 3: 아코디언/표 스타일 작성** — `styles.css`에 추가

```css
#fixed { margin:12px; }
#fixed details { background:var(--card); border-radius:12px; margin-bottom:10px; overflow:hidden; }
#fixed summary { padding:14px 16px; font-weight:600; cursor:pointer; list-style:none; }
#fixed summary::-webkit-details-marker { display:none; }
#fixed summary::after { content:"▾"; float:right; color:var(--muted); }
#fixed details[open] summary::after { content:"▴"; }
.acc { padding:0 16px 14px; font-size:.9rem; }
.tblwrap { overflow-x:auto; margin-top:8px; }
.acc table { border-collapse:collapse; width:100%; font-size:.85rem; }
.acc caption { text-align:left; font-weight:600; color:var(--muted); padding:4px 0; }
.acc th,.acc td { border-bottom:1px solid #eef2f4; padding:6px 8px; text-align:left; }
.acc td.num,.acc th.num { text-align:right; white-space:nowrap; }
.acc tfoot td { font-weight:700; }
.acc ul { margin:8px 0 0; padding-left:18px; }
```

- [ ] **Step 4: 브라우저 확인**

새로고침.
Expected: 하단에 라피트/숙소/준비물/경비/팁 아코디언. 라피트는 왕복 2표, 경비표 합계 2,612,367원. 표는 가로 넘칠 때 자체 스크롤.

- [ ] **Step 5: Commit**

```bash
git add Trip/app.js Trip/styles.css && git commit -m "feat: fixed info accordion"
```

---

### Task 5: localStorage 편집 (준비물 체크 + 뭐먹지 메모)

**Files:**
- Modify: `C:\Pcall\Trip\app.js`
- Modify: `C:\Pcall\Trip\styles.css`

**Interfaces:**
- Consumes: `window.TRIP.packing`, `#packing-body`(Task 4), 각 일자의 `day.meals`(Task 3b에서 추가한 문자열 배열, `\n` 포함 가능).
- Produces: `store` 객체 `{get(key,fallback), set(key,val)}` (localStorage 래퍼, JSON, prefix `osaka-trip:v1:`); `renderPacking()`; `mealKey(dayN, i)`; `renderTimeline`이 각 일자 카드 하단에 "🍽 뭐먹지" 섹션을 렌더하고 각 항목에 메모 입력창을 부착.

**설명:** 엑셀의 "뭐먹지"(식사 미정) 항목은 시간표가 아니라 일차별 별도 목록(`day.meals`)에 있다.
따라서 메모 편집은 시간표 슬롯이 아니라 이 뭐먹지 항목에 붙인다. Task 3의 `.slot.undecided`
하이라이트 로직은 그대로 두되(현재 데이터엔 매칭 슬롯 없음, 무해) 편집은 뭐먹지 항목으로 한다.

- [ ] **Step 1: store 래퍼 + mealKey + 검증**

```javascript
var store = {
  _p: "osaka-trip:v1:",
  get: function (k, fb) {
    try { var v = localStorage.getItem(this._p + k); return v === null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  },
  set: function (k, v) {
    try { localStorage.setItem(this._p + k, JSON.stringify(v)); } catch (e) {}
  }
};
function mealKey(dayN, i) { return "meal:" + dayN + ":" + i; }
```

Run: `cd /c/Pcall/Trip && node -e "$(sed -n '/function mealKey/,/^}/p' app.js); console.log(mealKey(3,1))"`
Expected: `meal:3:1`

- [ ] **Step 2: renderPacking 작성 (체크 상태 저장)** — `app.js`에 추가

```javascript
function renderPacking() {
  const body = document.getElementById("packing-body");
  if (!body) return;
  const checked = store.get("packing", {});
  body.innerHTML = '<ul class="packlist">' + window.TRIP.packing.map(function (item, i) {
    const on = checked[i] ? ' checked' : '';
    return '<li><label><input type="checkbox" data-i="' + i + '"' + on + '> ' + item + '</label></li>';
  }).join('') + '</ul>';
  body.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const c = store.get("packing", {});
      c[cb.dataset.i] = cb.checked;
      store.set("packing", c);
      cb.closest('li').classList.toggle('done', cb.checked);
    });
    if (cb.checked) cb.closest('li').classList.add('done');
  });
}
```

- [ ] **Step 3: renderTimeline에 "🍽 뭐먹지" 섹션 추가** — 기존 `renderTimeline`의 `main.innerHTML = ...` 대입식을 아래로 교체 (slots 뒤에 meals 블록을 덧붙임)

```javascript
  const escAttr = function (s) { return String(s).replace(/"/g, '&quot;'); };
  const meals = (day.meals && day.meals.length)
    ? '<div class="meals"><div class="meals-h">🍽 뭐먹지</div>' +
      day.meals.map(function (m, i) {
        const lines = m.split('\n').map(function (l) {
          return '<div class="line">' + l + '</div>';
        }).join('');
        const val = escAttr(store.get(mealKey(day.n, i), ""));
        return '<div class="meal"><div class="meal-note">' + lines + '</div>' +
          '<input class="memo" data-key="' + mealKey(day.n, i) +
          '" placeholder="식당/메모 입력" value="' + val + '"></div>';
      }).join('') + '</div>'
    : '';
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + day.n + '일차</span> ' +
      '<span class="ddate">' + day.date + '(' + day.dow + ')</span>' +
      '<div class="dtheme">' + day.theme.replace(/\n/g, ' · ') + '</div></div>' +
      '<div class="slots">' + rows + '</div>' + meals + '</div>';
```

- [ ] **Step 4: 메모 입력 저장 핸들러** — `renderTimeline` 끝(`main.innerHTML = ...` 다음)에 추가

```javascript
  main.querySelectorAll('.memo').forEach(function (inp) {
    inp.addEventListener('input', function () { store.set(inp.dataset.key, inp.value); });
  });
```

- [ ] **Step 5: 부트스트랩에서 renderPacking 호출** — `renderFixed(...)` 다음 줄에 `renderPacking();` 추가

- [ ] **Step 6: 편집 스타일 작성** — `styles.css`에 추가

```css
.packlist { list-style:none; padding:0; margin:8px 0 0; }
.packlist li { padding:6px 0; }
.packlist li.done label { text-decoration:line-through; color:var(--muted); }
.packlist input { transform:scale(1.2); margin-right:8px; }
.meals { padding:12px 16px; border-top:1px solid #eef2f4; background:#fff9f2; }
.meals-h { font-weight:700; color:var(--accent2); margin-bottom:8px; }
.meal { margin-bottom:12px; }
.meal:last-child { margin-bottom:0; }
.meal-note .line { font-size:.9rem; }
.memo { display:block; width:100%; margin-top:6px; padding:8px 10px;
  border:1px solid #ffd8a8; border-radius:8px; font:inherit; background:#fff; }
```

- [ ] **Step 7: 검증 (헤드리스, 브라우저 대체)**

Node의 `vm` 등으로 fake `document`/`localStorage`를 만들어 data.js+app.js를 로드한 뒤:
1. `mealKey(3,1)` === `"meal:3:1"` 확인.
2. `selectDay(3)` 호출 후 `#timeline` innerHTML에 `meals-h`(🍽 뭐먹지)와 2개의 `.memo` 입력이 있는지 확인.
3. `renderPacking()`이 6개 체크박스를 그리고, store에 미리 넣어둔 체크/메모 값이 렌더에 반영되는지 확인(예: `store.set("packing",{0:true})` 후 첫 항목 checked).
정확한 접근과 결과를 보고할 것. (실제 브라우저 F5 지속성 확인은 컨트롤러가 수행.)

- [ ] **Step 8: Commit** (git 저장소일 때만)

```bash
git add Trip/app.js Trip/styles.css && git commit -m "feat: localStorage packing checks and meal memos"
```

---

### Task 6: PWA (매니페스트 + 서비스워커 + 아이콘) 및 오프라인

**Files:**
- Create: `C:\Pcall\Trip\manifest.json`
- Create: `C:\Pcall\Trip\sw.js`
- Create: `C:\Pcall\Trip\icon.svg`
- Modify: `C:\Pcall\Trip\index.html` (서비스워커 등록)

**Interfaces:**
- Consumes: 모든 정적 자산 목록.
- Produces: 오프라인 캐시. `sw.js` 캐시명 `osaka-trip-v1`.

- [ ] **Step 1: icon.svg 작성**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b7285"/>
  <text x="256" y="330" font-size="300" text-anchor="middle" fill="#fff"
    font-family="'Noto Sans KR',sans-serif">大</text>
</svg>
```

- [ ] **Step 2: manifest.json 작성**

```json
{
  "name": "오사카 여행",
  "short_name": "오사카",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0b7285",
  "theme_color": "#0b7285",
  "icons": [
    { "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: sw.js 작성**

```javascript
const CACHE = "osaka-trip-v1";
const ASSETS = ["./", "./index.html", "./styles.css", "./data.js", "./app.js",
  "./manifest.json", "./icon.svg"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
```

- [ ] **Step 4: index.html에 서비스워커 등록 + 아이콘 링크** — `</body>` 앞, `app.js` 스크립트 뒤에 추가하고 `<head>`에 아이콘 링크 추가

head에 추가:
```html
  <link rel="icon" href="icon.svg">
  <link rel="apple-touch-icon" href="icon.svg">
```
body 스크립트 뒤에 추가:
```html
  <script>
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  </script>
```

- [ ] **Step 5: 로컬 서버로 PWA/오프라인 확인**

Run: `cd /c/Pcall/Trip && python -m http.server 8080` (백그라운드) 후 브라우저에서 `http://localhost:8080/` 접속.
Expected: 정상 렌더. DevTools > Application > Service Workers에 `osaka-trip-v1` 활성. 오프라인 체크 후 새로고침해도 로드됨. (참고: `file://`에서는 SW 미등록이지만 앱 자체는 정상 동작.)

- [ ] **Step 6: Commit**

```bash
git add Trip/manifest.json Trip/sw.js Trip/icon.svg Trip/index.html && git commit -m "feat: PWA offline support"
```

---

### Task 7: 최종 정리 — superpowers 폴더를 C:\Pcall 아래로 이동

**Files:**
- Move: `C:\Pcall\Trip\docs\superpowers\*` 및 `C:\Pcall\planer\docs\superpowers\*` → `C:\Pcall\superpowers\`

**설명:** 사용자 요청 — 여러 프로젝트에 흩어진 `docs/superpowers`(specs/plans) 폴더를 `C:\Pcall` 바로 아래 하나의 `superpowers` 폴더로 모은다. 기존 파일을 덮어쓰지 않도록 프로젝트별 하위 폴더로 정리한다.

- [ ] **Step 1: 현재 superpowers 관련 폴더 전수 확인**

Run: `find /c/Pcall -type d -name superpowers 2>/dev/null`
Expected: `Trip/docs/superpowers`, `planer/docs/superpowers` 등 목록 확인.

- [ ] **Step 2: 목적지 구조 생성 및 이동 (프로젝트별 하위 폴더 보존)**

```bash
mkdir -p "/c/Pcall/superpowers/trip" "/c/Pcall/superpowers/planer"
cp -r /c/Pcall/Trip/docs/superpowers/* "/c/Pcall/superpowers/trip/" 2>/dev/null
cp -r /c/Pcall/planer/docs/superpowers/* "/c/Pcall/superpowers/planer/" 2>/dev/null
```

- [ ] **Step 3: 이동 검증 후 원본 제거**

Run: `find /c/Pcall/superpowers -type f`
Expected: trip/specs, trip/plans, planer/specs 등 파일이 모두 복사됨을 확인.
확인 후: `rm -rf /c/Pcall/Trip/docs /c/Pcall/planer/docs/superpowers` (빈 `docs`는 남으면 함께 정리)

- [ ] **Step 4: 최종 확인**

Run: `find /c/Pcall/superpowers -type f && echo '---' && find /c/Pcall -type d -name superpowers`
Expected: `C:\Pcall\superpowers` 아래에만 파일이 존재하고, 프로젝트 하위 `docs/superpowers`는 사라짐.

---

## Self-Review 결과

- **Spec coverage:** 상단 요약(T2), 날짜 탭·타임라인(T3), 고정정보 아코디언·라피트·숙소·경비·팁(T4), 준비물 체크·메모 저장(T5), PWA 오프라인(T6), 데이터(T1), 폴더 이동(T7) — 스펙 전 항목 커버.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드/명령/기대출력 포함. TBD 없음.
- **Type consistency:** `store.get/set`, `memoKey`, `renderTimeline`/`renderTabs`/`selectDay`/`renderFixed`/`renderPacking`, `window.TRIP.{meta,days,rapit,expenses,packing,tips}` 명칭이 태스크 간 일치.
- **Note:** `git commit` 스텝은 `C:\Pcall`이 git 저장소가 아니면 건너뛴다(Global Constraints).
