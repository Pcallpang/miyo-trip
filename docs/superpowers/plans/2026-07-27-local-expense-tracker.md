# 현지 경비 기록 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오사카 여행 PWA에 현지에서 쓴 돈을 엔화로 기록하고 원화 병기 합계를 보여주는 기능을 추가한다.

**Architecture:** 순수 함수(집계·환산) → 읽기 전용 렌더 → 상호작용 → 상단 요약 연동 순으로 쌓는다. 기록은 전부 localStorage에 저장하고 `data.js`는 건드리지 않는다. 기존 `renderPacking()` 패턴(목록 + 추가 폼 + 삭제 버튼 + `store` 저장)을 그대로 따른다.

**Tech Stack:** 바닐라 JS (ES5 스타일 `var`/`function`, 일부 `const` 혼용), 빌드 도구 없음, localStorage, `bundle.py`(단일 파일 생성), GitHub Pages.

## Global Constraints

- 분류는 **식비 / 교통 / 쇼핑 / 관광 / 기타** 5개 고정. 순서도 이 순서.
- 환율 기본값 **900** (100엔당 원). 저장 키 `fx`.
- 원화 환산은 **합계와 상단 요약에만** 적용. 개별 항목·분류 칩에는 엔화만 표시.
- 환산식: `Math.round(jpy * fx / 100)`
- `data.js`는 **수정 금지**.
- 사용자 입력 문자열은 반드시 기존 `escHtml()`로 이스케이프.
- `store`는 기존 래퍼를 그대로 사용 (접두사 `osaka-trip:v1:`).
- 이 프로젝트에는 테스트 러너가 없다. 검증은 `test.html`(순수 함수)과 브라우저 콘솔 확인(UI)으로 한다.
- 작업 디렉터리는 `C:\Pcall\Trip`. 모든 명령은 여기서 실행한다.

---

### Task 1: 순수 함수 + 테스트 하네스

집계·환산 로직을 DOM과 분리해 먼저 만든다. 이 함수들만 `test.html`로 검증한다.

**Files:**
- Modify: `C:\Pcall\Trip\app.js` (10행 `store` 정의 직후에 삽입, 205행 init 가드 추가)
- Create: `C:\Pcall\Trip\test.html`

**Interfaces:**
- Consumes: 기존 `store.get/set`
- Produces:
  - `SPEND_CATS: string[]` — 분류 5개
  - `spendList(): Array<{id:number, date:string, jpy:number, cat:string, note:string}>`
  - `spendFx(): number` — 유효하지 않으면 `0`
  - `spendTotalJpy(list): number`
  - `jpyToKrw(jpy:number, fx:number): number`
  - `spendByCat(list): Array<{cat:string, jpy:number}>` — 지출 있는 분류만, `SPEND_CATS` 순서
  - `spendByDate(list): Array<{date:string, items:Array}>` — 날짜 내림차순, 같은 날은 최신 추가분이 앞

- [ ] **Step 1: 테스트 하네스 작성 (실패하는 상태)**

`C:\Pcall\Trip\test.html` 생성:

```html
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>경비 함수 테스트</title>
<style>body{font:14px monospace;padding:16px}.f{color:#c92a2a;font-weight:700}.p{color:#0b7043}</style>
</head>
<body>
<h1>경비 함수 테스트</h1>
<div id="out"></div>
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

var L = [
  { id: 1, date: "2026-07-29", jpy: 1200, cat: "식비", note: "이치란" },
  { id: 2, date: "2026-07-29", jpy: 800,  cat: "교통", note: "지하철" },
  { id: 3, date: "2026-07-30", jpy: 2000, cat: "식비", note: "저녁" },
  { id: 4, date: "2026-07-28", jpy: 500,  cat: "기타", note: "" }
];

eq('합계', spendTotalJpy(L), 4500);
eq('빈 목록 합계', spendTotalJpy([]), 0);
eq('잘못된 금액은 0으로', spendTotalJpy([{jpy:"abc"},{jpy:100}]), 100);

eq('환산 900', jpyToKrw(4500, 900), 40500);
eq('환산 반올림', jpyToKrw(1234, 900), 11106);
eq('환율 0이면 0', jpyToKrw(4500, 0), 0);

eq('분류별 집계', spendByCat(L), [
  { cat: "식비", jpy: 3200 },
  { cat: "교통", jpy: 800 },
  { cat: "기타", jpy: 500 }
]);
eq('빈 목록 분류', spendByCat([]), []);

eq('날짜별 그룹', spendByDate(L).map(function (g) {
  return { date: g.date, ids: g.items.map(function (e) { return e.id; }) };
}), [
  { date: "2026-07-30", ids: [3] },
  { date: "2026-07-29", ids: [2, 1] },
  { date: "2026-07-28", ids: [4] }
]);

eq('분류 목록', SPEND_CATS, ["식비", "교통", "쇼핑", "관광", "기타"]);

document.getElementById('out').innerHTML =
  '<h2>' + (failed ? failed + '개 실패' : '전부 통과') + '</h2>' + results.join('');
</script>
</body>
</html>
```

- [ ] **Step 2: 실패 확인**

```bash
cd /c/Pcall/Trip && python -m http.server 8801
```

브라우저에서 `http://localhost:8801/test.html` 열기.
Expected: 콘솔에 `Uncaught ReferenceError: spendTotalJpy is not defined`, 화면에 결과 없음.

- [ ] **Step 3: 순수 함수 구현**

`app.js` 10행 `};`(store 정의 끝) 다음, `function mealKey`(11행) 앞에 삽입:

```js

var SPEND_CATS = ["식비", "교통", "쇼핑", "관광", "기타"];

function spendList() {
  var v = store.get("spend", []);
  return Array.isArray(v) ? v : [];
}
function spendFx() {
  var n = Number(store.get("fx", 900));
  return isFinite(n) && n > 0 ? n : 0;
}
function spendTotalJpy(list) {
  return list.reduce(function (s, e) {
    var n = Number(e.jpy);
    return s + (isFinite(n) ? n : 0);
  }, 0);
}
function jpyToKrw(jpy, fx) {
  return Math.round(jpy * fx / 100);
}
function spendByCat(list) {
  var m = {};
  list.forEach(function (e) {
    var n = Number(e.jpy);
    m[e.cat] = (m[e.cat] || 0) + (isFinite(n) ? n : 0);
  });
  return SPEND_CATS.filter(function (c) { return m[c]; })
    .map(function (c) { return { cat: c, jpy: m[c] }; });
}
function spendByDate(list) {
  var m = {}, dates = [];
  list.forEach(function (e) {
    if (!m[e.date]) { m[e.date] = []; dates.push(e.date); }
    m[e.date].push(e);
  });
  dates.sort().reverse();
  return dates.map(function (d) {
    return { date: d, items: m[d].slice().reverse() };
  });
}
```

- [ ] **Step 4: init 가드 추가**

`test.html`은 `window.TRIP` 없이 `app.js`를 읽으므로 초기화가 터진다. `app.js`의 `DOMContentLoaded` 핸들러 첫 줄에 가드를 넣는다.

변경 전:
```js
document.addEventListener("DOMContentLoaded", function () {
  renderSummary(window.TRIP.meta);
```

변경 후:
```js
document.addEventListener("DOMContentLoaded", function () {
  if (!window.TRIP) return;
  renderSummary(window.TRIP.meta);
```

- [ ] **Step 5: 통과 확인**

`http://localhost:8801/test.html` 새로고침 (Ctrl+Shift+R).
Expected: 화면 상단에 **"전부 통과"**, 9줄 모두 초록 PASS, 콘솔 에러 없음.

- [ ] **Step 6: 커밋**

```bash
cd /c/Pcall/Trip
git add app.js test.html
git commit -m "feat: 현지 경비 집계 순수 함수 추가"
```

---

### Task 2: 읽기 전용 렌더 + 스타일

아코디언을 만들고 저장된 데이터를 표시한다. 입력·삭제는 다음 태스크.

**Files:**
- Modify: `C:\Pcall\Trip\app.js` (`renderSpend()` 신규, `renderFixed()` 내 아코디언 추가, init에 호출 추가)
- Modify: `C:\Pcall\Trip\styles.css` (78행 끝에 추가)

**Interfaces:**
- Consumes: Task 1의 `spendList`, `spendFx`, `spendTotalJpy`, `jpyToKrw`, `spendByCat`, `spendByDate`, `SPEND_CATS`, 기존 `escHtml`
- Produces: `renderSpend()` — `#spend-body`를 채운다. 요소가 없으면 아무것도 하지 않는다.

- [ ] **Step 1: 아코디언 자리 추가**

`app.js` `renderFixed()` 안, 준비물 `</details>` 다음 줄(현재 140행)에 한 줄 삽입:

변경 전:
```js
    '<details><summary>🎒 준비물</summary><div class="acc" id="packing-body"></div></details>' +
    '<details><summary>💰 경비 내역</summary><div class="acc"><div class="tblwrap"><table>' +
```

변경 후:
```js
    '<details><summary>🎒 준비물</summary><div class="acc" id="packing-body"></div></details>' +
    '<details><summary>💸 현지 경비</summary><div class="acc" id="spend-body"></div></details>' +
    '<details><summary>💰 경비 내역</summary><div class="acc"><div class="tblwrap"><table>' +
```

- [ ] **Step 2: `renderSpend()` 구현**

`app.js` `renderPacking()` 함수 끝(현재 203행 `}`) 다음에 삽입:

```js

function renderSpend() {
  const body = document.getElementById("spend-body");
  if (!body) return;
  const list = spendList();
  const fx = spendFx();
  const tot = spendTotalJpy(list);
  const krw = fx
    ? ' <span class="skrw">(약 ' + jpyToKrw(tot, fx).toLocaleString('ko-KR') + '원)</span>'
    : '';
  const chips = spendByCat(list).map(function (c) {
    return '<li>' + c.cat + ' <b>¥' + c.jpy.toLocaleString('ko-KR') + '</b></li>';
  }).join('');
  const groups = spendByDate(list).map(function (g) {
    const rows = g.items.map(function (e) {
      const n = Number(e.jpy);
      return '<li><span class="scat">' + escHtml(e.cat) + '</span>' +
        '<span class="snote">' + escHtml(e.note || e.cat) + '</span>' +
        '<span class="sjpy">¥' + (isFinite(n) ? n : 0).toLocaleString('ko-KR') + '</span>' +
        '<button class="spend-del" type="button" data-id="' + e.id + '" aria-label="삭제">×</button></li>';
    }).join('');
    return '<div class="sgroup"><div class="sdate">' + escHtml(g.date) + '</div>' +
      '<ul class="slist">' + rows + '</ul></div>';
  }).join('');
  body.innerHTML =
    '<div class="stotal">¥' + tot.toLocaleString('ko-KR') + krw + '</div>' +
    (chips ? '<ul class="scats">' + chips + '</ul>' : '') +
    '<form class="spend-add">' +
      '<input class="sjpy-in" type="number" inputmode="numeric" min="1" step="1" ' +
        'placeholder="금액 ¥" aria-label="금액(엔)">' +
      '<input class="snote-in" type="text" placeholder="내용" aria-label="내용">' +
      '<select class="scat-in" aria-label="분류">' +
        SPEND_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') +
      '</select>' +
      '<button type="submit">추가</button>' +
    '</form>' +
    (groups || '<div class="sempty">아직 기록이 없습니다.</div>') +
    '<div class="sfx">100엔 = <input class="sfx-in" type="number" min="0" step="1" value="' +
      fx + '"> 원</div>';
}
```

- [ ] **Step 3: init에서 호출**

`app.js` 마지막 `renderPacking();` 다음 줄에 추가:

```js
  renderPacking();
  renderSpend();
});
```

- [ ] **Step 4: 스타일 추가**

`styles.css` 맨 끝(78행 이후)에 추가:

```css
.stotal { font-size:1.35rem; font-weight:800; color:var(--accent); margin-top:8px; }
.stotal .skrw { font-size:.85rem; font-weight:600; color:var(--muted); }
.scats { list-style:none; padding:0; margin:10px 0 0; display:flex; flex-wrap:wrap; gap:6px; }
.scats li { font-size:.78rem; background:#f1f5f7; border-radius:999px; padding:4px 10px; color:var(--muted); }
.scats li b { color:var(--text); }
.spend-add { display:flex; flex-wrap:wrap; gap:6px; margin:12px 0; }
.spend-add input,.spend-add select { padding:8px 10px; border:1px solid #d5dde1;
  border-radius:8px; font:inherit; min-width:0; }
.spend-add .sjpy-in { flex:0 0 90px; }
.spend-add .snote-in { flex:1 1 110px; }
.spend-add .scat-in { flex:0 0 auto; background:#fff; }
.spend-add button { flex:0 0 auto; padding:8px 14px; border:none; border-radius:8px;
  background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
.sgroup { margin-top:12px; }
.sdate { font-size:.78rem; font-weight:700; color:var(--muted); padding-bottom:4px;
  border-bottom:1px solid #eef2f4; }
.slist { list-style:none; padding:0; margin:0; }
.slist li { display:flex; align-items:center; gap:8px; padding:8px 0;
  border-bottom:1px solid #f4f7f8; }
.slist .scat { flex:0 0 auto; font-size:.72rem; font-weight:700; color:#fff;
  background:var(--accent); border-radius:999px; padding:2px 8px; }
.slist .snote { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.slist .sjpy { flex:0 0 auto; font-weight:700; white-space:nowrap; }
.spend-del { flex:0 0 auto; border:none; background:#f1f3f5; color:var(--muted);
  width:26px; height:26px; border-radius:50%; font-size:1.1rem; line-height:1; cursor:pointer; }
.sempty { color:var(--muted); padding:10px 0; }
.sfx { margin-top:14px; font-size:.82rem; color:var(--muted); }
.sfx input { width:70px; padding:5px 8px; border:1px solid #d5dde1; border-radius:6px;
  font:inherit; text-align:right; }
```

- [ ] **Step 5: 시드 데이터로 표시 확인**

`http://localhost:8801/index.html` 을 열고 콘솔에서 실행:

```js
localStorage.setItem('osaka-trip:v1:spend', JSON.stringify([
  {id:1, date:"2026-07-29", jpy:1200, cat:"식비", note:"이치란"},
  {id:2, date:"2026-07-30", jpy:800,  cat:"교통", note:"지하철"}
]));
location.reload();
```

새로고침 후 "💸 현지 경비" 아코디언을 펼친다.
Expected:
- 합계 `¥2,000 (약 18,000원)`
- 칩 `식비 ¥1,200` `교통 ¥800`
- 07-30 그룹이 07-29 그룹보다 **위**
- 입력 폼과 `100엔 = 900 원` 표시
- 삭제 `×` 버튼은 보이지만 **아직 눌러도 반응 없음** (다음 태스크)

- [ ] **Step 6: 커밋**

```bash
cd /c/Pcall/Trip
git add app.js styles.css
git commit -m "feat: 현지 경비 아코디언 표시"
```

---

### Task 3: 입력 · 삭제 · 환율 설정

**Files:**
- Modify: `C:\Pcall\Trip\app.js` (`renderSpend()` 끝에 이벤트 핸들러 추가)

**Interfaces:**
- Consumes: Task 2의 `renderSpend()`와 그 안의 DOM 클래스 (`.spend-add`, `.sjpy-in`, `.snote-in`, `.scat-in`, `.spend-del`, `.sfx-in`)
- Produces: 없음 (`renderSpend()` 내부에서 완결)

- [ ] **Step 1: 핸들러 추가**

`renderSpend()` 안 `body.innerHTML = ...;` 대입문 **다음**, 함수 닫는 `}` 앞에 삽입:

```js

  const form = body.querySelector('.spend-add');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const jin = form.querySelector('.sjpy-in');
    const jpy = Math.round(Number(jin.value));
    if (!isFinite(jpy) || jpy <= 0) { jin.focus(); return; }
    const cur = spendList();
    let id = Date.now();
    while (cur.some(function (x) { return x.id === id; })) id++;
    cur.push({
      id: id,
      date: new Date().toISOString().slice(0, 10),
      jpy: jpy,
      cat: form.querySelector('.scat-in').value,
      note: form.querySelector('.snote-in').value.trim()
    });
    store.set("spend", cur);
    renderSpend();
    renderSummary(window.TRIP.meta);
    const next = body.querySelector('.sjpy-in');
    if (next) next.focus();
  });

  body.querySelectorAll('.spend-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = Number(btn.dataset.id);
      store.set("spend", spendList().filter(function (x) { return x.id !== id; }));
      renderSpend();
      renderSummary(window.TRIP.meta);
    });
  });

  const fxin = body.querySelector('.sfx-in');
  fxin.addEventListener('change', function () {
    store.set("fx", Number(fxin.value) || 0);
    renderSpend();
    renderSummary(window.TRIP.meta);
  });
```

**주의:** `renderSummary(window.TRIP.meta)` 호출은 Task 4에서 상단 요약이 현지 합계를 읽도록 고친 뒤에야 의미가 생긴다. 지금 넣어두면 Task 4에서 추가 수정이 필요 없다. `window.TRIP`은 `index.html`에서 항상 정의되므로 안전하다.

- [ ] **Step 2: 날짜 계산 확인**

`new Date().toISOString()`은 UTC 기준이라 한국·일본(UTC+9)에서 **오전 0~9시 사이에 전날 날짜**가 나온다. 기존 코드(`app.js` init, `renderSummary`)도 같은 방식을 쓰고 있어 일관성을 위해 그대로 둔다.

이 동작을 확인만 하고 넘어간다. 콘솔에서:

```js
new Date().toISOString().slice(0,10)
```

Expected: 오늘 날짜(현지 시각 오전 9시 이후라면). 다르면 그대로 진행하되 사용자에게 보고한다.

- [ ] **Step 3: 동작 확인**

`http://localhost:8801/index.html` 새로고침 후 콘솔에서 초기화:

```js
localStorage.removeItem('osaka-trip:v1:spend');
localStorage.removeItem('osaka-trip:v1:fx');
location.reload();
```

아코디언을 펼치고 손으로 확인:

| 동작 | 기대 결과 |
|---|---|
| 금액 비우고 "추가" | 아무 일 없음, 금액칸에 커서 |
| 금액 `-100` 입력 후 추가 | 추가 안 됨 |
| 금액 `abc` 입력 후 추가 | 추가 안 됨 (number 입력칸이라 입력 자체가 막힐 수 있음 — 그것도 통과) |
| `1200` / `이치란` / 식비 추가 | 목록에 오늘 날짜로 추가, 합계 `¥1,200 (약 10,800원)` |
| 내용 비우고 `500` / 교통 추가 | 목록에 내용 대신 `교통` 표시 |
| 환율칸을 `950`으로 변경 | 합계 원화가 `¥1,700 → 약 16,150원`으로 즉시 바뀜 |
| 환율칸을 비움 | 원화 병기만 사라지고 `¥1,700`은 유지 |
| 새로고침 | 기록 유지 |
| 항목 하나 `×` | 그 항목만 사라지고 합계 재계산 |

- [ ] **Step 4: 커밋**

```bash
cd /c/Pcall/Trip
git add app.js
git commit -m "feat: 현지 경비 입력/삭제/환율 설정"
```

---

### Task 4: 상단 요약 연동 + 배포

**Files:**
- Modify: `C:\Pcall\Trip\app.js` (`renderSummary()` 23-33행)
- Modify: `C:\Pcall\Trip\sw.js` (1행 캐시 버전)
- Regenerate: `C:\Pcall\Trip\osaka-trip.html`

**Interfaces:**
- Consumes: Task 1의 `spendList`, `spendFx`, `spendTotalJpy`, `jpyToKrw`
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: `renderSummary()` 수정**

`app.js` 23-33행. 변경 전 마지막 줄:

```js
    '<div class="cost">💰 총 ' + meta.totalCostKRW.toLocaleString('ko-KR') + '원 (2인)</div>';
}
```

변경 후:

```js
    '<div class="cost">💰 총 ' + meta.totalCostKRW.toLocaleString('ko-KR') + '원 (2인)' +
      summarySpend() + '</div>';
}
function summarySpend() {
  const tot = spendTotalJpy(spendList());
  if (!tot) return '';
  const fx = spendFx();
  const krw = fx ? ' (약 ' + jpyToKrw(tot, fx).toLocaleString('ko-KR') + '원)' : '';
  return ' <span class="spent">· 💸 현지 ¥' + tot.toLocaleString('ko-KR') + krw + '</span>';
}
```

- [ ] **Step 2: 스타일 추가**

`styles.css` `.stotal` 규칙 앞에 추가:

```css
#summary .cost .spent { display:inline-block; opacity:.95; }
```

- [ ] **Step 3: 상단 표시 확인**

`http://localhost:8801/index.html` 에서:

```js
localStorage.removeItem('osaka-trip:v1:spend'); location.reload();
```
Expected: 상단에 `💰 총 2,612,367원 (2인)` 만. `💸 현지` **없음**.

이어서 아코디언에서 `1200` / 식비 추가.
Expected: 상단이 즉시 `💰 총 2,612,367원 (2인) · 💸 현지 ¥1,200 (약 10,800원)`

- [ ] **Step 4: 캐시 버전 올리기**

`sw.js` 1행:

```js
const CACHE = "osaka-trip-v6";
```

- [ ] **Step 5: 번들 재생성**

```bash
cd /c/Pcall/Trip && python bundle.py
```
Expected: `wrote C:\Pcall\Trip\osaka-trip.html ( 24xxxx chars )`

- [ ] **Step 6: 커밋 & 배포**

```bash
cd /c/Pcall/Trip
git add app.js styles.css sw.js osaka-trip.html
git commit -m "feat: 상단 요약에 현지 경비 합계 표시"
git push origin main
```

- [ ] **Step 7: 배포 확인**

Pages 반영까지 30~60초 기다린 뒤:

```bash
for i in $(seq 1 8); do
  n=$(curl -s "https://pcallpang.github.io/osaka-trip/app.js?t=$(date +%s)" | grep -c "summarySpend")
  echo "try $i: $n"; [ "$n" -ge 1 ] && break; sleep 15
done
```
Expected: `try N: 1`

브라우저에서 `https://pcallpang.github.io/osaka-trip/` 를 열고 서비스워커 갱신:

```js
const r = await navigator.serviceWorker.getRegistration(); await r.update();
await new Promise(x=>setTimeout(x,1500)); location.reload();
```

확인:
- `(await caches.keys())` → `["osaka-trip-v6"]`
- 아코디언 "💸 현지 경비"가 보이고 추가/삭제가 동작
- 항목 추가 후 상단에 합계 표시

- [ ] **Step 8: 오프라인 확인**

DevTools → Network → Offline 체크 후 새로고침.
Expected: 페이지가 그대로 열리고, 기록한 경비도 그대로 보인다.

확인 후 Offline 해제.

---

## Self-Review

**Spec 커버리지**

| 스펙 요구사항 | 태스크 |
|---|---|
| 상단 요약에 합계, 기록 있을 때만 | Task 4 Step 1-3 |
| 아코디언 위치(준비물 다음) | Task 2 Step 1 |
| 합계 / 분류칩 / 입력폼 / 목록 / 환율 5개 영역 | Task 2 Step 2 |
| 분류 5개 고정 | Task 1 (`SPEND_CATS`) |
| 날짜 자동, 날짜 내림차순·같은 날 최신 우선 | Task 1 `spendByDate`, Task 3 Step 1 |
| localStorage 키 `spend` / `fx`, 기본 900 | Task 1 |
| 환산은 합계에만 | Task 2 Step 2, Task 4 Step 1 |
| id 충돌 회피 | Task 3 Step 1 (`while` 루프) |
| 금액 무효 시 거부 | Task 3 Step 1, 검증 Step 3 |
| 내용 비면 분류명 표시 | Task 2 Step 2 (`e.note \|\| e.cat`) |
| 환율 0/빈값이면 병기 생략 | Task 1 `spendFx`, Task 2 Step 2 |
| 배열 아니면 빈 배열 폴백 | Task 1 `spendList` |
| `escHtml` 이스케이프 | Task 2 Step 2 |
| `data.js` 미변경 | 어느 태스크도 건드리지 않음 |
| sw 캐시 v6 | Task 4 Step 4 |
| 오프라인 동작 | Task 4 Step 8 |

빠진 요구사항 없음.

**Placeholder 스캔:** "TBD", "적절히 처리" 류 없음. 모든 코드 단계에 실제 코드 포함.

**타입 일관성:** `spendList`/`spendFx`/`spendTotalJpy`/`jpyToKrw`/`spendByCat`/`spendByDate`/`SPEND_CATS` 이름이 Task 1 정의와 Task 2·3·4 사용처에서 일치. DOM 클래스명(`.sjpy-in`, `.snote-in`, `.scat-in`, `.sfx-in`, `.spend-del`, `.spend-add`)이 Task 2 생성부와 Task 3 조회부에서 일치.

**알려진 한계 (의도적):** `new Date().toISOString()`의 UTC 기준 날짜 문제는 기존 코드와 동일하게 두었다 (Task 3 Step 2에 명시). 여행 중 오전 9시 이전에 기록하면 전날로 들어간다.
