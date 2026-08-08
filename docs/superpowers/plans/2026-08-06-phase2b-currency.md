# 2단계-B 통화·환율 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경비를 여행지 통화로 기록하고 원화 환산을 자동으로 보여준다. 지금은 `¥`와 "100엔 = 900원"이 코드에 박혀 있어 엔화 이외의 여행에서는 쓸 수 없다.

**Architecture:** 데이터 마이그레이션을 **가장 먼저** 한다 — 1단계 리뷰가 "사용자가 경비를 기록할수록 비싸진다"고 지적한 지점이고, 실제로 기록이 쌓이는 중이다. 그다음 순수 함수(통화 프리셋·환산·포맷)를 깔고, 환율 조회를 `remote.js`에 얹고, 마지막에 화면의 `¥` 리터럴을 걷어낸다.

**Tech Stack:** 바닐라 JS(기존 스타일), open.er-api.com(키 불요), localStorage, Python(bundle.py).

## Global Constraints

- 작업 디렉터리 `C:\Pcall\Trip`. `main`이 아닌 새 브랜치.
- 빌드 도구·프레임워크·npm 의존성 없음. `<script>` + 전역 함수.
- 코드 스타일은 기존 파일을 따른다 — `function` 선언, `var`/`const` 혼용, 문자열 연결로 HTML 생성. 화살표 함수·클래스·ES 모듈 금지.
- 스크립트 로드 순서: `sample-trip.js` → `store.js` → `schema.js` → **`money.js`** → `remote.js` → `views.js` → `editor.js` → `app.js`. `index.html`·`test.html`·`test-node.js` 세 곳.
- `test-node.js`는 `files` 배열을 **최상위 `for` 루프**로 eval한다. `forEach` 금지.
- 테스트는 `node test-node.js`(정본)와 `test.html`(개수 일치). **현재 328개 통과.**
- 이스케이프 규율: `innerHTML`에 닿는 문자열은 `escHtml`, 숫자는 `Number()`. **환율 API 응답은 외부 입력이다.**
- `saveTrip`/`saveTripBody`/`lsSet`의 성공 boolean을 버리지 않는다.
- 렌더 범위 규율: 경비를 하나 추가·삭제해도 입력 중이던 값이 살아남아야 한다(이미 `renderSpend`가 보존한다 — 깨뜨리지 말 것).
- 커밋: `git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" commit -m "..."`, 한국어, 접두사 규칙 유지.
- 브라우저 확인은 `python -m http.server 8123`. **8000번 금지.**
- **브라우저 HTTP 캐시 주의:** `location.reload()`만으로는 수정한 스크립트가 반영되지 않는 일이 반복됐다. `fetch(f,{cache:'no-store'})` 후 `(0,eval)(t)`로 주입해 확인할 것.
- **외부 API는 브라우저에서 잰다.** 2단계-A에서 다른 도구의 측정값을 믿고 스펙을 잘못 고친 전례가 있다.

---

## API 실측 결과 (2026-08-08, 이 계획의 전제)

`https://open.er-api.com/v6/latest/KRW` — 키 불요, `Access-Control-Allow-Origin: *`, 브라우저에서 322ms 응답.

```
result: "success" | rates 166개 | base_code: "KRW"
time_last_update_utc: Sat, 08 Aug 2026 00:02:31 +0000
time_next_update_utc: Sun, 09 Aug 2026 00:17:01 +0000
provider: https://www.exchangerate-api.com
documentation: https://www.exchangerate-api.com/docs/free
terms_of_use: https://www.exchangerate-api.com/terms
```

확인한 22개 통화(JPY·USD·EUR·VND·TWD·THB·CNY·HKD·SGD·PHP·MYR·IDR·MOP·KHR·LAK·GBP·AUD·CHF·TRY·AED·INR·CZK) **전부 존재**. 처음 후보였던 Frankfurter는 ECB 기준 31개뿐이고 VND·TWD가 없어 폐기했다(스펙 참고).

**환산 방향:** `rates`는 **1 KRW당 해당 통화**다. `rates.JPY = 0.111682` → 1원 = 0.111682엔. 따라서
`원화 = 현지금액 / rates[코드]`. 검산: 1200엔 / 0.111682 = 10,745원 (기존 고정환율 900원/100엔 = 10,800원과 근사).

**이용 조건 — 출처 표기가 필수다.** 무료 등급 문서: *"We require attribution on the pages you're using these rates with the link below"*, 권장 형식 `<a href="https://www.exchangerate-api.com">Rates By Exchange Rate API</a>`. 눈에 띄지 않게 앱 톤에 맞춰도 되지만 **링크는 있어야 한다.** 경비 탭 하단에 넣는다.

**요청 빈도:** 하루 1회면 제한에 전혀 걸리지 않는다. 초과 시 429이고 20분 뒤 풀린다. 환율은 하루 한 번 갱신되므로 **TTL 12시간**으로 잡는다(날씨의 30분과 다르다).

---

## 데이터 모델 변경

```js
// trip.currency — 이미 스키마에 있으나 지금은 아무도 읽지 않는다
currency: { code:"JPY", symbol:"¥", decimals:0, unit:100 }

// trip:<id>:spend  레코드
// 전: { id, date, jpy, cat, note }
// 후: { id, date, amount, cur, cat, note }
//   cur가 필요한 이유: 일차마다 통화가 다를 수 있어(2단계-A의 일차별 도시와 같은 사정)
//   금액만으로는 나중에 환산할 수 없다.

// fx — 여행 밖 전역 키 하나. KRW 기준 한 번 조회로 모든 통화를 얻는다.
fx: { at: "2026-08-08T00:02:31Z", rates: { JPY: 0.111682, … } }

// trip:<id>:fxManual — 사용자가 직접 넣은 환율 { JPY: 900, … } 형태로 통화별.
//   있으면 자동 조회값보다 우선한다(스펙의 rateManual을 통화별로 편 것).
```

`decimals`는 소수점 자릿수다. JPY·KRW·VND는 0, USD·EUR는 2. 금액 입력의 `step`과 반올림이 이 값을 따른다.

`unit`은 표시용이다 — "100엔 = 900원"처럼 읽기 좋게 하기 위한 것이고, 계산은 항상 1단위 기준이다.

---

### Task 1: 경비 레코드 마이그레이션

**가장 먼저 한다.** 기록이 쌓일수록 비싸지고, 뒤로 미룰수록 되돌리기 어렵다.

**Files:**
- Modify: `C:\Pcall\Trip\store.js`
- Modify: `C:\Pcall\Trip\app.js` (부팅 시 호출)
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Produces:
  - `migrateSpendRecord(rec, defCur): rec` — 순수. `{jpy}` → `{amount, cur}`. 이미 새 형식이면 그대로
  - `migrateSpend(): number` — 여행별로 적용, 바뀐 여행 수 반환. 재실행 안전

**설계 요점:** 구 레코드는 통화 정보가 없다. 당시 앱이 엔화 전용이었으므로 **`cur`는 그 여행의 `trip.currency.code`(없으면 `"JPY"`)로 채운다.** 이게 유일하게 옳은 추정이다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// ---- 경비 레코드 마이그레이션 ----
eq('구 레코드 변환', migrateSpendRecord({ id:1, date:'2026-07-29', jpy:1200, cat:'식비', note:'이치란' }, 'JPY'),
  { id:1, date:'2026-07-29', amount:1200, cur:'JPY', cat:'식비', note:'이치란' });
eq('이미 새 형식이면 그대로',
  migrateSpendRecord({ id:2, date:'2026-07-29', amount:500, cur:'USD', cat:'교통', note:'' }, 'JPY').cur, 'USD');
eq('기본 통화를 따른다',
  migrateSpendRecord({ id:3, date:'2026-07-29', jpy:900, cat:'기타', note:'' }, 'VND').cur, 'VND');
eq('금액이 숫자가 아니면 0', migrateSpendRecord({ id:4, jpy:'abc' }, 'JPY').amount, 0);

(function () {
  __resetStorage();
  var t = emptyTrip({ title:'테스트', start:'2026-09-01', end:'2026-09-02' });
  t.currency = { code:'JPY', symbol:'¥', decimals:0, unit:100 };
  saveTrip(t);
  tripStore(t.id).set('spend', [
    { id:1, date:'2026-09-01', jpy:1200, cat:'식비', note:'라멘' },
    { id:2, date:'2026-09-01', jpy:800,  cat:'교통', note:'' }
  ]);
  eq('마이그레이션이 한 여행을 고침', migrateSpend(), 1);
  var got = tripStore(t.id).get('spend', []);
  eq('금액 보존', got[0].amount, 1200);
  eq('통화 부여', got[0].cur, 'JPY');
  eq('구 필드 제거', got[0].jpy, undefined);
  eq('두 번째 실행은 0건', migrateSpend(), 0);
})();
```

- [ ] **Step 2: 실패 확인 → Step 3: `store.js` 구현**

```js
// 구 경비 레코드는 통화 정보가 없다 — 당시 앱이 엔화 전용이었으므로 그 여행의
// 기본 통화(없으면 JPY)로 채운다. 이게 유일하게 옳은 추정이다.
function migrateSpendRecord(rec, defCur) {
  if (!rec || typeof rec !== "object") return rec;
  if (rec.cur !== undefined || rec.amount !== undefined) return rec;
  var out = {};
  for (var k in rec) {
    if (Object.prototype.hasOwnProperty.call(rec, k) && k !== "jpy") out[k] = rec[k];
  }
  var n = Number(rec.jpy);
  out.amount = isFinite(n) ? n : 0;
  out.cur = defCur || "JPY";
  return out;
}

// 재실행해도 안전하다 — 이미 새 형식이면 아무 것도 쓰지 않는다.
function migrateSpend() {
  var changed = 0;
  listTrips().forEach(function (row) {
    var trip = loadTrip(row.id);
    if (!trip) return;
    var st = tripStore(row.id);
    var list = st.get("spend", []);
    if (!Array.isArray(list) || !list.length) return;
    var needs = list.some(function (r) { return r && r.jpy !== undefined && r.cur === undefined; });
    if (!needs) return;
    var defCur = (trip.currency && trip.currency.code) || "JPY";
    if (st.set("spend", list.map(function (r) { return migrateSpendRecord(r, defCur); }))) changed++;
  });
  return changed;
}
```

`app.js`의 `DOMContentLoaded`에서 `migrateSections();` 다음 줄에 `migrateSpend();`를 넣는다.

- [ ] **Step 4: 통과 확인과 커밋**

```bash
cd /c/Pcall/Trip && node test-node.js
git add store.js app.js tests.js
git -c user.name="Pcallpang" -c user.email="ljh6479z@naver.com" \
  commit -m "feat: 경비 레코드를 통화 포함 형식으로 마이그레이션"
```

---

### Task 2: `money.js` — 통화 프리셋과 환산

**Files:**
- Create: `C:\Pcall\Trip\money.js`
- Modify: `index.html`, `test.html`, `test-node.js`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Produces:
  - `CURRENCIES: Array<{code, symbol, decimals, unit, name}>`
  - `currencyByCode(code): obj|null`
  - `defaultCurrency(): obj` — KRW
  - `fmtAmount(amount, cur): string` — `"¥1,200"`, `"$12.50"`, `"₫120,000"`
  - `toKRW(amount, code, rates): number|null` — 환율이 없으면 `null`
  - `fmtKRW(krw): string` — `"10,744원"`
  - `spendTotals(list): Array<{cur, amount}>` — 통화별 합계
  - `spendByCat(list)` / `spendByDate(list)` — **views.js에서 이곳으로 옮긴다**(통화 축이 붙는다)

**통화 프리셋** (`code symbol decimals unit`):
JPY ¥ 0 100 · KRW ₩ 0 1 · USD $ 2 1 · EUR € 2 1 · THB ฿ 2 1 · VND ₫ 0 1000 ·
TWD NT$ 0 1 · CNY ¥ 2 1 · HKD HK$ 2 1 · SGD S$ 2 1 · PHP ₱ 2 1 · MYR RM 2 1 ·
IDR Rp 0 1000 · GBP £ 2 1 · AUD A$ 2 1 · MOP MOP$ 2 1 · KHR ៛ 0 1000 ·
LAK ₭ 0 1000 · INR ₹ 2 1 · CHF CHF 2 1 · CZK Kč 2 1 · TRY ₺ 2 1 · AED AED 2 1

목록에 없는 코드는 `{code, symbol:code, decimals:2, unit:1}`로 만들어 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// ---- 통화 ----
eq('JPY 프리셋', currencyByCode('JPY').symbol, '¥');
eq('JPY는 소수점 없음', currencyByCode('JPY').decimals, 0);
eq('USD는 소수점 둘', currencyByCode('USD').decimals, 2);
eq('VND 단위 1000', currencyByCode('VND').unit, 1000);
eq('모르는 코드는 코드 자체를 기호로', currencyByCode('XYZ').symbol, 'XYZ');
eq('기본 통화는 원화', defaultCurrency().code, 'KRW');

eq('엔 표기', fmtAmount(1200, currencyByCode('JPY')), '¥1,200');
eq('달러 표기(소수점 둘)', fmtAmount(12.5, currencyByCode('USD')), '$12.50');
eq('동 표기(소수점 없음)', fmtAmount(120000, currencyByCode('VND')), '₫120,000');
eq('엔은 반올림', fmtAmount(1200.7, currencyByCode('JPY')), '¥1,201');

// rates는 1 KRW당 해당 통화다(실측) — 원화 = 금액 / rates[코드]
var RATES = { JPY: 0.111682, USD: 0.000708, VND: 18.53835 };
eq('엔 → 원', toKRW(1200, 'JPY', RATES), 10745);
eq('달러 → 원', toKRW(10, 'USD', RATES), 14124);
eq('원 → 원은 그대로', toKRW(5000, 'KRW', RATES), 5000);
eq('환율 없으면 null', toKRW(100, 'ZZZ', RATES), null);
eq('rates 없으면 null', toKRW(100, 'JPY', null), null);
eq('원화 표기', fmtKRW(10745), '10,745원');

// 통화별 합계 — 한 여행에 여러 통화가 섞일 수 있다
var SL = [
  { id:1, amount:1200, cur:'JPY', cat:'식비', date:'2026-09-01' },
  { id:2, amount:800,  cur:'JPY', cat:'교통', date:'2026-09-01' },
  { id:3, amount:12.5, cur:'USD', cat:'식비', date:'2026-09-02' }
];
eq('통화별 합계', spendTotals(SL), [{ cur:'JPY', amount:2000 }, { cur:'USD', amount:12.5 }]);
eq('빈 목록', spendTotals([]), []);
```

- [ ] **Step 2~3: 구현**

`fmtAmount`는 `decimals`를 `toLocaleString('ko-KR', {minimumFractionDigits, maximumFractionDigits})`로 넘긴다. `toKRW`는 `Math.round(amount / rates[code])`, `KRW`는 그대로 반환.

`spendByCat`/`spendByDate`를 `views.js`에서 옮기고 `jpy` → `amount`로 고친다. `spendByCat`은 `{cat, cur, amount}`를 돌려주도록 통화 축을 붙인다. **기존 단언이 `jpy`를 기대하므로 함께 고친다.**

`spendTotalJpy`/`jpyToKrw`는 삭제한다 — 호출부를 Task 4에서 전부 바꾼다. 관련 단언도 새 함수 기준으로 옮긴다.

- [ ] **Step 4: 로드 등록과 통과 확인 → 커밋**

---

### Task 3: 환율 조회

**Files:**
- Modify: `C:\Pcall\Trip\remote.js`
- Modify: `C:\Pcall\Trip\tests.js`

**Interfaces:**
- Produces:
  - `FX_URL`, `FX_TTL_MS` (12시간)
  - `fxGet(): {at, rates}|null` — 전역 `fx` 키
  - `fxRefresh(onDone)` — 캐시 우선, 실패해도 앱 동작
  - `fxRate(code, st): number|null` — **수동 환율이 있으면 그것을 우선**
  - `FX_ATTRIB_HTML` — 출처 표기 링크(이용 조건상 필수)

**수동 환율:** 사용자가 직접 넣은 값은 `trip:<id>:fxManual`에 `{JPY: 900}` 형태로 통화별 저장한다. 스펙의 `rateManual`을 통화별로 편 것이다 — 한 여행에 여러 통화가 있을 수 있으므로 단일 플래그로는 부족하다.

**수동값의 단위:** 화면에서 "100엔 = 900원"처럼 `unit` 기준으로 받되, 저장은 **1단위 기준 원화**로 정규화한다(`900/100 = 9`). 안 그러면 통화마다 단위가 달라 계산이 갈린다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// ---- 환율 ----
eq('FX_URL은 KRW 기준', FX_URL.indexOf('/latest/KRW') >= 0, true);
eq('출처 표기에 링크가 있다', FX_ATTRIB_HTML.indexOf('exchangerate-api.com') >= 0, true);

(function () {
  __resetStorage();
  lsSet('fx', { at:'2026-08-08T00:00:00Z', rates:{ JPY:0.111682, USD:0.000708 } });
  var st = tripStore('t_fx');
  eq('자동 환율을 읽는다', fxRate('JPY', st), 0.111682);
  eq('모르는 통화는 null', fxRate('ZZZ', st), null);

  // 수동값은 1단위 기준 원화로 저장된다 — 9원/엔이면 rates 환산과 같은 축으로 뒤집는다
  st.set('fxManual', { JPY: 9 });
  eq('수동 환율이 자동보다 우선', Math.round(1 / fxRate('JPY', st)), 9);
})();
```

- [ ] **Step 2~3: 구현.** `fxRefresh`는 `wxRefresh`와 같은 패턴(캐시 우선, 진행 중 중복 차단, 실패해도 조용히). TTL 12시간.

---

### Task 4: 화면에서 `¥` 걷어내기

**Files:**
- Modify: `C:\Pcall\Trip\views.js` (`renderSpend`, `summarySpend`)
- Modify: `C:\Pcall\Trip\editor.js` (여행 설정에 통화 선택)
- Modify: `C:\Pcall\Trip\styles.css`
- Modify: `C:\Pcall\Trip\tests.js`

바꿀 지점 (`views.js`): `summarySpend`의 `¥` 리터럴과 `jpyToKrw`, `renderSpend`의 `.stotal`·분류 칩·목록 항목·입력 `placeholder`·`aria-label`·`.sfx`의 "100엔 = … 원".

**경비 입력:** 금액 옆에 통화 선택을 둔다. 기본값은 **그 일차의 통화**(`dayCurrency`, 2단계-A의 `dayPlace`와 같은 구조)이고, 없으면 여행 기본 통화다.

**합계 표시:** 통화가 하나면 지금과 같게 `¥12,000 (약 107,400원)`. 여럿이면 통화별로 줄을 나누고 맨 아래 **원화 환산 총합**을 둔다.

**출처 표기:** 경비 탭 하단에 `FX_ATTRIB_HTML`을 넣는다. 이용 조건상 필수다.

**여행 설정:** 통화 선택 `<select>`(프리셋 목록) + "직접 입력" 옵션. 저장은 `f.currency`로 넘겨 `applyTripForm`이 처리한다(`f.place`와 같은 방식).

- [ ] **Step 1~5:** 테스트 → 구현 → 브라우저 확인 → 커밋.

브라우저 확인 항목:
1. 오사카 샘플에서 기존 경비가 `¥`로 그대로 보이고 원화 환산이 붙는다
2. 통화를 USD로 바꾼 여행에서 `$12.50`처럼 소수점 둘로 표시된다
3. 한 여행에 JPY·USD를 섞으면 통화별 합계 + 원화 총합이 나온다
4. 수동 환율을 넣으면 그 값이 쓰이고, 비우면 자동값으로 돌아온다
5. 경비를 추가·삭제해도 입력 중이던 값이 살아남는다(기존 동작 유지)
6. 오프라인에서 환율 캐시가 쓰이고 앱이 정상 동작한다

---

### Task 5: 서비스워커·번들러·회귀

- [ ] `sw.js` `ASSETS`에 `"./money.js"` 추가, `CACHE`를 `"trip-v11"`로
- [ ] `bundle.py` `SCRIPTS`에 `"money.js"`를 `schema.js`와 `remote.js` 사이에
- [ ] 회귀: 오사카 샘플 회귀 / 마이그레이션(구 `jpy` 레코드를 심고 부팅) / 다통화 / 오프라인 / XSS / 탭·일차 전환 / 입력 보존
- [ ] 커밋

---

## 완료 기준

- `node test-node.js` 전부 통과, `test.html`도 같은 개수
- `¥`·`jpyToKrw`·`spendTotalJpy`·"100엔" 리터럴이 코드에서 사라졌다
- 구 `{jpy}` 레코드가 자동으로 `{amount, cur}`로 옮겨진다(재실행 안전)
- 통화가 섞인 여행에서 통화별 합계와 원화 총합이 함께 보인다
- 환율 자동 조회가 실패해도 수동 입력으로 계속 쓸 수 있다
- 경비 탭에 환율 출처 표기 링크가 있다(이용 조건)

## 이 계획의 범위가 아닌 것

- 사용자 정의 섹션 편집기 (2단계-C)
- 일차별 이미지 첨부 (2단계-D)
- 내보내기·가져오기 (3단계)
- `views.js`가 `CUR`을 읽는 구조 정리
