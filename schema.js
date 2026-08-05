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
// 메서드를 부르는 필드는 그것 말고도 둘 더 있다 — day.date(escHtml(d.date.slice(5)),
// dowOf(day.date))와 item.text(isUndecided(it.text)). 세 필드를 같은 계약으로 한 번에
// 보정한다. 값을 버리지 않고 문자열로 맞추기만 하므로 정상 데이터에는 아무 영향이 없다.
function normalizeDay(day) {
  if (!day) return null;
  if (!Array.isArray(day.items)) day.items = [];
  if (typeof day.date !== 'string') day.date = '';
  day.items = day.items.filter(function (it) { return it && typeof it === 'object'; });
  day.items.forEach(function (it) {
    if (typeof it.text !== 'string') it.text = it.text == null ? '' : String(it.text);
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
