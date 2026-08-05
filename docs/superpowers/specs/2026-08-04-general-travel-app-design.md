# 범용 여행앱 개편 설계

날짜: 2026-08-04
대상: `C:\Pcall\Trip` (현 오사카 여행 PWA, https://pcallpang.github.io/osaka-trip/)

## 배경

2026-07-28~08-03 오사카 여행을 무사히 마쳤다. 이제 다른 사람도 자기 여행에 쓸 수
있는 앱으로 개편한다.

뼈대(일차별 타임라인, 경비 기록, 준비물 체크, 날씨, 오프라인 캐시)는 이미 동작한다.
유일한 근본 장벽은 **여행 데이터가 코드에 박혀 있다는 것**이다.

오사카 전용으로 고정된 지점:

| 위치 | 내용 |
|---|---|
| `data.js` 전체 | 오사카 일정 하드코딩 (`gen_data.py`가 xlsx에서 1회 생성) |
| `app.js:59` | 날씨 좌표 `34.69/135.5`, `timezone=Asia/Tokyo` |
| `app.js:28` | `jpyToKrw` — JPY 100엔 단위 환산 고정 |
| `app.js:182-203, 236` | USJ 지도, `day.n === 2`일 때만 표시 |
| `app.js:256-273` | 라피트 시간표 전용 렌더 |
| `app.js:2` | localStorage 접두사 `osaka-trip:v1:` |
| 곳곳 | `¥` 리터럴, `"(2인)"` |

## 요구사항 (브레인스토밍 확정)

- **백엔드 없음.** 각자 자기 브라우저에 저장. 계정·서버·비용 0
- **앱 안 편집기.** 여행 생성과 일정 추가/수정/삭제를 폰에서 직접. 엑셀·스크립트 불요
- **오사카 전용 요소는 범용 첨부 기능으로 흡수.** 라피트 표 → 사용자 정의 섹션,
  USJ 지도 → 일차별 이미지 첨부. 내 오사카 여행도 그대로 재현되어야 한다
- **여행별 통화 + 환율 자동 조회.** 수동 입력으로 항상 덮어쓸 수 있게
- **일차별 도시·통화 지정.** 한 여행이 여러 나라를 지나는 경우(예: 베트남 →
  대만 경유)가 흔하다. `days[]`가 여행 기본값을 덮어쓰는 `place`·`curCode`를
  갖고, 날씨는 그 일차의 좌표로, 금액은 그 일차의 통화로 표시한다
- **앱 사용자는 한국인 전제.** UI는 한국어 고정, 기준 통화는 원화(KRW).
  현지 통화 금액은 언제나 "약 ○○원"을 함께 보여준다
- **GitHub Pages 배포.** 이미 배포 중인 URL을 그대로 쓴다

목표 결과: 링크를 받은 사람이 "여행 만들기"를 눌러 도시·날짜를 넣으면, 자기 일정·
경비·준비물·날씨가 있는 오프라인 동작 여행앱을 갖게 된다. 내 오사카 여행은 샘플
여행으로 앱에 남는다.

## 데이터 모델

`window.TRIP` 하드코딩을 버리고 localStorage에 저장되는 Trip 객체로 전환한다.

```js
// trip:index → [{ id, title, start, end }]   여행 목록 화면용 요약
// trip:<id>  → Trip 전체
{
  schema: 1,
  id: "t_1754…",
  title: "오사카 여행",
  start: "2026-07-28", end: "2026-08-03",
  party: 2,                                    // "총 ○○원 (2인)"의 2
  place: { name:"오사카", lat:34.69, lon:135.5, tz:"Asia/Tokyo" },   // 여행 기본 도시
  currency: { code:"JPY", symbol:"¥", decimals:0, unit:100,
              rateKRW:900, rateAt:null, rateManual:false },
  hotel: "…",
  budgetKRW: 2612367,
  days: [{ n, date, theme,
           place: null,      // null이면 trip.place 상속. 그 일차만 다른 도시일 때 지정
           curCode: null,    // null이면 trip.currency 상속. 경유국 통화용
           items:[{id,time,text}], meals:[], images:[imageId] }],
  sections: [{ id, icon, title,
               type:"builtin"|"text"|"list"|"table", body }],
  packing: ["여권", …],
  expenses: [{ date, cat, detail, pay, krw, note }]   // 출발 전 결제 내역
}

// 런타임 상태는 여행별로 분리
// trip:<id>:spend  → [{ id, date, amount, cur, cat, note }]   (기존 필드 jpy → amount)
// trip:<id>:packing_checked / packing_add / meal:<n>:<i>
// trip:<id>:wx:<lat>,<lon>  → 좌표별 날씨 캐시 (일차마다 도시가 다를 수 있으므로)
// fx                        → 환율 캐시. 여행 밖 전역 키 하나로 공유한다
```

- `dow`(요일)는 저장하지 않고 `date`에서 파생한다. 현재는 `gen_data.py`가 수기 매핑해 두었다
- `sections`가 라피트 시간표와 팁을 모두 흡수한다. `type:"table"`은 `{caption, head, rows}`,
  `type:"list"`는 문자열 배열, `type:"text"`는 문자열
- `sections`는 **내장 섹션(숙소·준비물·현지 경비·경비 내역)까지 포함**한다.
  `type:"builtin"`에 `body`가 `"hotel"|"packing"|"spend"|"expenses"` 중 하나다.
  하단 아코디언은 이 배열을 그대로 순회해 그리므로 **순서가 데이터로 결정된다** —
  사용자가 내장 섹션과 사용자 정의 섹션을 섞어 정렬할 수 있다
- `spend` 레코드는 `cur`(그때 쓴 통화 코드)를 함께 저장한다. 일차마다 통화가
  다를 수 있어 금액만으로는 나중에 환산할 수 없다
- `currency.decimals`는 소수점 자릿수다. JPY·KRW·VND는 0, USD·EUR는 2
- 이미지는 Trip 객체에 넣지 않는다. IndexedDB에 blob으로 두고 id만 참조한다
  (localStorage 5MB 한도에 base64 지도 한 장이면 터진다)

## 화면 구성

```
┌ 여행 목록  #/            여행이 2개 이상일 때만 첫 화면
│    [오사카 여행 · 완료]  [새 여행 만들기]  [샘플 보기]
├ 여행 상세  #/t/<id>      지금 화면 그대로 (요약/일차탭/타임라인/고정섹션)
│    우상단 [편집] 토글 → 각 일정 카드에 수정·삭제·추가 버튼 노출
└ 여행 설정  #/t/<id>/edit 제목·기간·도시·통화·인원·숙소·섹션
```

여행이 하나뿐이면 목록을 건너뛰고 바로 상세로 간다 — 지금과 동일한 사용감을 유지한다.

## 파일 구성

`app.js` 435줄이 이미 저장소·날씨·렌더 5종을 다 한다. 편집기·여행목록·통화를 얹으면
1500줄을 넘는다. 이번 작업에 맞춰 쪼갠다.

| 파일 | 책임 |
|---|---|
| `store.js` | localStorage 래퍼, 여행 CRUD, 스키마 버전·마이그레이션, 가져오기 검증 |
| `remote.js` | Open-Meteo 예보 · Open-Meteo Geocoding · 환율. 모두 캐시 우선, 실패해도 앱 동작 |
| `views.js` | 렌더 함수 (summary/tabs/timeline/fixed/spend/packing) |
| `editor.js` | 여행 만들기·설정 화면, 일정 카드 편집, 섹션 편집 |
| `images.js` | IndexedDB 이미지 저장·리사이즈 |
| `app.js` | 라우팅과 부팅만 |

기존 순수 함수(`dday`, `wxIcon`, `wxDailyMap`, `wxLine`, `spendByCat`, `spendByDate`,
`escHtml`)는 그대로 옮겨 재사용한다. 이미 테스트 가능한 형태로 분리돼 있다.

빌드 도구는 도입하지 않는다. `<script>` 여러 개 + 전역 함수 — 지금 방식을 유지한다.

## 보안: 이스케이프

현재 `renderTimeline`은 `it.text`를 escape 없이 `innerHTML`에 넣는다(`app.js:216`).
`day.theme`, `meta.title`, `meta.hotel`, 팁 목록도 같다. 지금은 내 엑셀 데이터만
들어가서 무해하지만, 사용자 입력 편집기와 JSON 가져오기가 생기는 순간 실제
취약점이 된다.

`escHtml`은 이미 있다(`app.js:286`). 렌더 경로 **전체**에 적용한다. 줄바꿈을 `<div>`로
쪼개는 로직과 `(패스권-시간)`·`예약 완료` 태그 정규식은 escape **후** 적용한다.

## 유지할 휴리스틱

한국어 사용자에게 여전히 유용하고 설정으로 빼면 복잡도만 는다. 그대로 둔다.

- `isUndecided`의 `뭐먹지` / `?`로 끝나는 텍스트 → 미정 스타일
- `(패스권-시간)` `(시간)` → ⏰ 시간지정 배지
- `예약 완료` → ✅ 예약완료 배지

## 단계

세 단계로 나눈다. 각 단계 끝에서 앱은 동작하는 상태여야 한다.

### 1단계 — 데이터 모델과 편집기

이 단계만 끝나도 "남이 쓸 수 있는 앱"이 된다.

1. `store.js` 신설 — Trip CRUD, `trip:index`, 여행별 키 접두사, `schema` 필드
2. 마이그레이션
   - `data.js`의 오사카 여행 → 새 스키마로 변환해 `sample-trip.js`로 번들.
     라피트 표·팁은 `sections`로, 준비물은 `packing`으로
   - 기존 `osaka-trip:v1:*` 값이 있으면 새 여행 하나로 이관 후 구 키 제거
3. `views.js`로 렌더 이동. `window.TRIP` 전역 참조를 인자로 변경
4. 전 렌더 경로에 `escHtml` 적용
5. `editor.js` — 여행 만들기 폼, 시작·종료 날짜로 일차 자동 생성,
   일정 카드 추가/수정/삭제/시간변경
6. `app.js`를 `location.hash` 라우터로 축소
7. `sw.js` 자산 목록 갱신 + 캐시 버전 v8, `bundle.py` 파일 목록 갱신

### 2단계 — 장소·통화·첨부

1. **도시 검색** — Open-Meteo Geocoding
   (`geocoding-api.open-meteo.com/v1/search?name=…&language=ko`, 키 불요).
   `latitude/longitude/timezone`을 `place`에 저장 → 좌표 하드코딩 제거.
   한국어 결과가 **0건이면 `language=en`으로 한 번 더 조회**한다 — 중소도시는
   한국어 색인이 비어 있는 경우가 많다(예: "다낭"은 나오지만 "호이안"은 안 나온다).
   일차별 도시 지정도 같은 검색 UI를 쓴다
2. **통화** — `currency`로 `¥`·`÷100` 리터럴 전부 대체. `jpyToKrw` → `toKRW(amount, currency)`.
   경비 레코드 `jpy` → `amount` + `cur` 마이그레이션 포함.
   표시는 `decimals`를 따른다(VND `₫120,000`, USD `$12.50`).
   금액 입력의 `step`/반올림도 `decimals`로 결정한다
3. **환율 자동 조회** — `wxRefresh`와 같은 패턴(캐시 우선, 실패 시 마지막 값 유지).
   **`open.er-api.com/v6/latest/KRW`를 쓴다.** 처음 후보였던
   Frankfurter(`api.frankfurter.app`)는 ECB 기준이라 **31개 통화뿐이고 VND·TWD가 없다** —
   동남아·대만 여행에서 바로 막힌다. `open.er-api.com`은 키 없이 152개 통화
   (VND·TWD·MOP·KHR·LAK 포함)를 주고 하루 1회 갱신되며, 이용 조건상 **출처 표기가
   필요하다**(설정 화면 하단에 표기). KRW 기준 한 번 조회로 모든 통화를 얻으므로
   캐시는 `fx` 전역 키 하나면 된다. 수동 입력이 항상 있으므로 조회가 실패해도 앱은
   동작한다. 사용자가 직접 입력하면 `rateManual:true`로 자동 갱신을 멈춘다
4. **사용자 정의 섹션** — `sections[]` 편집 UI. 하단 아코디언이 이 배열을 순회해
   그린다 → 라피트 전용 렌더 제거
5. **일차별 이미지 첨부** — `<input type="file">` → canvas로 최대 1600px·JPEG 0.8
   리사이즈 → IndexedDB 저장, `day.images`에 id만. USJ 지도 하드코딩과
   `window.USJ_MAP_SRC` 제거

### 3단계 — 공유와 배포

1. **내보내기** — Trip JSON 다운로드(`Blob` + `<a download>`). 이미지는 base64 인라인
2. **가져오기** — 파일 선택 → 스키마 검증(필수 필드, 타입, 날짜 형식, 배열 길이 상한)
   → 새 id로 저장. 검증 실패 시 명확한 오류
3. **배포** — Pages는 이미 동작 중이다. `manifest.json`의 이름을 범용으로 바꾸고
   서브디렉터리에서 sw 경로가 유지되는지 확인한다. 저장소 이름 `osaka-trip`은
   그대로 둔다 — 바꾸면 기존 URL과 홈화면 아이콘이 깨진다
4. `bundle.py` 단일 HTML 유지. `file://`에서 IndexedDB는 브라우저별로 막히므로
   이미지 첨부만 degrade 처리
5. README — 사용법, 배포 방법, 오사카 샘플 소개

## 검증

1. **순수 함수 테스트** — `test.html`에 케이스 추가: 스키마 마이그레이션(구 → 신),
   `toKRW` 환산, 일차 자동 생성(시작·종료 → days), 가져오기 검증(정상/누락/타입오류/악성 HTML)
2. **오사카 회귀** — 샘플 여행 화면을 개편 전 `osaka-trip.html`과 비교. 라피트 표·
   USJ 지도·팁이 범용 섹션/이미지로 동일하게 보이는지
3. **새 여행 플로우** — localStorage를 비운 상태에서 여행 만들기 → 도시 검색 →
   일정 3개 → 경비 기록 → 준비물 체크 → 새로고침 후 유지
4. **오프라인** — DevTools Offline 후 재로드. 날씨·환율은 캐시 + 시각 스탬프,
   편집은 정상 동작
5. **XSS** — 일정 텍스트에 `<img src=x onerror=alert(1)>`를 넣고 리터럴로 보이는지.
   악성 JSON 가져오기도 동일하게
6. **실기기** — Pages 배포 후 폰에서 홈화면 추가, 오프라인 실행, 이미지 용량

## 하지 않는 것

- 실시간 동행자 공유·동시 편집 (백엔드가 필요하다)
- 회원가입·서버 저장·다기기 동기화
- 지도 연동, 장소 검색, 예약 연동
- 텍스트 일괄 붙여넣기 파싱 (편집기로 충분하다)
- 빌드 도구·프레임워크 도입
