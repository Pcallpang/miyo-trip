// 저장소 계층: 여행 목록·본체·여행별 런타임 키(trip:<id>:*)를 다룬다.
// app.js의 기존 osaka-trip:v1: store와는 무관한 새 코드다.

var SCHEMA = 1;

function lsGet(key, fb) {
  try {
    var v = localStorage.getItem(key);
    return v === null ? fb : JSON.parse(v);
  } catch (e) { return fb; }
}
// 쓰기 성공 여부를 boolean으로 돌려준다. 예외가 안 났다는 것만으론 부족하다 —
// 일부 환경(프라이빗 모드 등)은 setItem이 조용히 no-op일 수 있으므로 읽어서 확인한다.
function lsSet(key, v) {
  try {
    var s = JSON.stringify(v);
    localStorage.setItem(key, s);
    return localStorage.getItem(key) === s;
  } catch (e) { return false; }
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
    set: function (k, v) { return lsSet(tripKey(id, k), v); }
  };
}

function listTrips() {
  var v = lsGet("trip:index", []);
  return Array.isArray(v) ? v : [];
}

function saveTrip(trip) {
  var okBody = lsSet("trip:" + trip.id, trip);
  var idx = listTrips();
  var row = { id: trip.id, title: trip.title, start: trip.start, end: trip.end };
  var at = -1;
  idx.forEach(function (r, i) { if (r.id === trip.id) at = i; });
  if (at >= 0) idx[at] = row; else idx.push(row);
  var okIdx = lsSet("trip:index", idx);
  return okBody && okIdx;
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
// 복사가 하나라도 실제로 저장되지 않았으면(예: 용량 초과) 구 키를 절대 지우지 않고,
// 이번에 만든 반쪽짜리 새 여행은 되돌린 뒤 null을 돌려준다 — 다음 부팅 때
// 구 키가 그대로 남아 있으므로 깨끗하게 재시도된다(고아 여행이 쌓이지 않는다).
function migrateLegacy() {
  var found = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf(LEGACY_PREFIX) === 0) found.push(k);
  }
  if (!found.length) return null;

  var t = cloneSample();
  t.id = newTripId();
  var ok = saveTrip(t);
  var st = tripStore(t.id);
  found.forEach(function (k) {
    var sub = k.slice(LEGACY_PREFIX.length);
    // 알려진 키와 meal:<n>:<i> 형태만 옮긴다
    if (LEGACY_KEYS.indexOf(sub) >= 0 || sub.indexOf("meal:") === 0) {
      // st.set을 먼저 평가해야 ok가 이미 false여도 나머지 키 복사를 계속 시도한다
      ok = st.set(sub, lsGet(k, null)) && ok;
    }
  });

  if (!ok) {
    deleteTrip(t.id);
    return null;
  }

  found.forEach(lsDel);
  return t.id;
}
