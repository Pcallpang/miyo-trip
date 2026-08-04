// 저장소 계층: 여행 목록·본체·여행별 런타임 키(trip:<id>:*)를 다룬다.
// app.js의 기존 osaka-trip:v1: store와는 무관한 새 코드다.

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
