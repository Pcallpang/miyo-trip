// Trip 스키마 헬퍼: 일차 생성, 재동기화, 기본값.
// store.js 다음에 로드된다 (SCHEMA, newTripId 사용).

var DOW = ["일", "월", "화", "수", "목", "금", "토"];
var DAY_MS = 86400000;

function dateMs(iso) { return Date.parse(iso + "T00:00:00Z"); }
function msDate(ms) { return new Date(ms).toISOString().slice(0, 10); }

// 날짜가 비었거나(손상된 저장값) 파싱 불가능하면 빈 문자열 — 던지지도, 'undefined'를
// 화면에 흘리지도 않는다(normalizeDay 주석 참고).
function dowOf(iso) {
  var ms = dateMs(iso);
  return isNaN(ms) ? '' : DOW[new Date(ms).getUTCDay()];
}
function addDays(iso, n) { return msDate(dateMs(iso) + n * DAY_MS); }
function daysBetween(a, b) { return Math.round((dateMs(b) - dateMs(a)) / DAY_MS) + 1; }

var _seq = 0;
function newItemId() { return "i_" + Date.now().toString(36) + (_seq++).toString(36); }
function newSectionId() { return "s_" + Date.now().toString(36) + (_seq++).toString(36); }

function blankDay(n, iso) {
  return { n: n, date: iso, theme: "", place: null, curCode: null,
           items: [], meals: [], images: [] };
}

// 손상된 저장값(검증 없이 가져온 JSON, 손으로 고친 localStorage)이 렌더에서 예외를
// 던지지 않게 하는 최소 보정. 지금까지는 day.items만 배열로 맞춰줬는데, 렌더가 실제로
// 메서드를 부르는 필드는 그것 말고도 셋 더 있다 — day.date(escHtml(d.date.slice(5)),
// dowOf(day.date)), day.meals(renderTimeline의 .map — views.js:225-227), item.text
// (isUndecided(it.text)). 네 필드를 같은 계약으로 한 번에 보정한다. 값을 버리지 않고
// 배열/문자열로 맞추기만 하므로 정상 데이터에는 아무 영향이 없다.
// 실제로 뭔가를 고친 경우에만(정상 데이터는 절대 안 걸림) console.warn으로 남긴다 —
// pickDay가 보정한 값은 이후 saveTripBody가 그대로 되돌려 써버려 손상이 조용히
// 영구화되므로, 최소한 콘솔에서라도 원인(어느 필드가 어떤 값이었는지)을 추적할 수 있게 한다.
function normalizeDay(day) {
  if (!day) return null;
  if (!Array.isArray(day.items)) {
    console.warn('normalizeDay: day.items가 배열이 아니어서 빈 배열로 보정함', day.items);
    day.items = [];
  }
  if (typeof day.date !== 'string') {
    console.warn('normalizeDay: day.date가 문자열이 아니어서 빈 문자열로 보정함', day.date);
    day.date = '';
  }
  if (!Array.isArray(day.meals)) {
    console.warn('normalizeDay: day.meals가 배열이 아니어서 빈 배열로 보정함', day.meals);
    day.meals = [];
  }
  day.items = day.items.filter(function (it) { return it && typeof it === 'object'; });
  day.items.forEach(function (it) {
    if (typeof it.text !== 'string') {
      console.warn('normalizeDay: item.text가 문자열이 아니어서 빈 문자열로 보정함', it.text);
      it.text = it.text == null ? '' : String(it.text);
    }
  });
  return day;
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

// 내장 항목(숙소·준비물·경비)은 하단 탭이 됐다. sections는 사용자가 만든 것만 담는다.
function defaultSections() {
  return [];
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
  return (trip && trip.currency) || null;
}
