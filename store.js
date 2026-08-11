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

// 본체(큰 쓰기)와 인덱스(작은 쓰기)를 나눠 쓴다. 용량 초과 등으로 본체 쓰기만 실패하고
// 인덱스 쓰기는 성공하는 경우(실제로 재현됨), 인덱스만 갱신되고 본체는 예전 값 그대로
// 남으면 목록과 본체가 서로 다른 얘기를 하게 된다(새 여행이면 목록에 loadTrip이 null인
// 고아 항목이 생기고, 수정이면 목록엔 새 제목/날짜가 보이는데 본체는 예전 값). 그래서
// 본체 쓰기가 실패하면 인덱스는 아예 건드리지 않는다.
function saveTrip(trip) {
  var okBody = lsSet("trip:" + trip.id, trip);
  if (!okBody) return false;
  var idx = listTrips();
  var row = { id: trip.id, title: trip.title, start: trip.start, end: trip.end };
  var at = -1;
  idx.forEach(function (r, i) { if (r.id === trip.id) at = i; });
  if (at >= 0) idx[at] = row; else idx.push(row);
  return lsSet("trip:index", idx);
}

function loadTrip(id) {
  return lsGet("trip:" + id, null);
}

// 일정 항목(추가·수정·삭제) 전용 저장. 인덱스 행(id/title/start/end)은 항목 편집으로
// 바뀌지 않으므로 본체만 쓴다 — saveTrip처럼 인덱스까지 같이 쓰면, 실제로는 본체 저장이
// 성공했는데 인덱스 쓰기만(용량 초과 등으로) 실패한 경우에도 saveTrip이 false를 돌려줘
// 정상 반영된 편집을 실패로 취급해버린다. 본체만 쓰면 그 모호함 자체가 없어진다.
function saveTripBody(trip) {
  return lsSet("trip:" + trip.id, trip);
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

// 저장에 성공하면 새 여행 id, 실패하면 null. 다른 쓰기 경로(submitTripForm,
// afterItemEdit)와 동일하게 성공 여부를 호출부에 넘긴다 — 여기서 삼키면 저장이
// 실패해도 화면은 존재하지 않는 여행으로 이동했다가 목록으로 되튕길 뿐이라
// 사용자에게 실패가 전혀 드러나지 않는다.
function installSample() {
  var t = cloneSample();
  t.id = newTripId();
  // 결제 내역은 id로 가리켜 수정·삭제한다. migrateExpenseIds는 부팅 때 한 번 도는데
  // 샘플 설치는 그보다 나중이라, 여기서 채우지 않으면 샘플의 내역은 눌러도 열리지
  // 않는다(data-id가 undefined가 된다). 데이터 파일에 id를 박아 두는 대신 설치할 때
  // 부여한다 — 샘플을 두 번 설치해도 서로 다른 id가 된다.
  (Array.isArray(t.expenses) ? t.expenses : []).forEach(function (e) {
    if (e && !e.id) e.id = newExpenseId();
  });
  return saveTrip(t) ? t.id : null;
}

// ---- 식사 메모 키: 일차 번호 → 날짜 ----
// meal 메모는 원래 meal:<n>:<i>로 저장됐는데, resyncDays는 날짜를 기준으로 일차를
// 보존하면서 n을 1부터 다시 매긴다. 그래서 시작일을 하루 앞당기기만 해도 모든 n이
// 밀려 메모가 엉뚱한 날에 붙거나(meals가 없는 날로 밀리면) 아예 화면에서 사라진다.
// 날짜는 그 일차의 안정된 식별자이므로 meal:<date>:<i>로 다시 키를 잡는다.

// trip.days에서 { 일차번호: 날짜 } 표를 만든다.
function dayDateByN(trip) {
  var m = {};
  var days = (trip && Array.isArray(trip.days)) ? trip.days : [];
  days.forEach(function (d) {
    if (d && typeof d.date === 'string' && d.date) m[String(d.n)] = d.date;
  });
  return m;
}

// 구 키(meal:<숫자>:<i>)를 새 키(meal:<날짜>:<i>)로 옮긴다. 옮길 필요가 없거나
// 옮길 수 없으면 null:
//  - meal: 로 시작하지 않는 키
//  - 가운데 조각이 숫자가 아닌 키 = 이미 날짜 기준이다(YYYY-MM-DD에는 '-'가 있다).
//    이 판정 덕분에 마이그레이션을 몇 번을 돌려도 두 번째부터는 아무 것도 하지 않는다.
//  - 그 번호에 해당하는 일차가 없는 여행(고아 메모는 건드리지 않고 남겨 둔다)
function mealMigrateKey(sub, byN) {
  var m = /^meal:([0-9]+):(.+)$/.exec(String(sub));
  if (!m) return null;
  var date = byN[m[1]];
  return date ? ("meal:" + date + ":" + m[2]) : null;
}

// 저장된 모든 여행의 구 식사 메모 키를 한 번 옮긴다. 여러 번 불러도 안전하다
// (위 mealMigrateKey가 이미 날짜 기준인 키를 걸러낸다). 새 키 쓰기가 실패하면
// 구 키를 지우지 않으므로 다음 부팅에 그대로 재시도된다. 옮긴 키 개수를 돌려준다.
function stripBuiltinSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.filter(function (s) { return !s || s.type !== "builtin"; });
}

// 내장 섹션은 하단 탭이 됐으므로 데이터에서 걷어낸다. 재실행해도 안전하다
// (걸러낼 게 없으면 길이가 같아 쓰기를 건너뛴다).
function migrateSections() {
  var changed = 0;
  listTrips().forEach(function (row) {
    var trip = loadTrip(row.id);
    if (!trip) return;
    var next = stripBuiltinSections(trip.sections);
    if (next.length === (trip.sections || []).length) return;
    trip.sections = next;
    if (saveTripBody(trip)) changed++;
  });
  return changed;
}

function migrateMealKeys() {
  var moved = 0;
  listTrips().forEach(function (row) {
    var trip = loadTrip(row.id);
    if (!trip) return;
    var byN = dayDateByN(trip);
    var prefix = tripKey(row.id, "meal:");
    var found = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) found.push(k);
    }
    found.forEach(function (k) {
      var sub = k.slice(tripKey(row.id, "").length);
      var nk = mealMigrateKey(sub, byN);
      if (!nk || nk === sub) return;
      var target = tripKey(row.id, nk);
      // 이미 날짜 기준 값이 있으면 그쪽이 최신이다 — 구 키만 치운다.
      if (localStorage.getItem(target) !== null) { lsDel(k); moved++; return; }
      if (lsSet(target, lsGet(k, null))) { lsDel(k); moved++; }
    });
  });
  return moved;
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
  var byN = dayDateByN(t);
  found.forEach(function (k) {
    var sub = k.slice(LEGACY_PREFIX.length);
    // 알려진 키와 meal:<n>:<i> 형태만 옮긴다
    if (LEGACY_KEYS.indexOf(sub) >= 0 || sub.indexOf("meal:") === 0) {
      // 구 데이터의 meal 키는 일차 번호 기준이다 — 옮기는 김에 날짜 기준으로 바꿔
      // 넣는다. 그래야 migrateMealKeys와 이 함수의 실행 순서가 어느 쪽이든 결과가
      // 같다(이 함수가 먼저면 애초에 옮길 게 없고, migrateMealKeys가 먼저였다면
      // 그때는 이 여행이 아직 없었으므로 여기서 처리된다).
      // st.set을 먼저 평가해야 ok가 이미 false여도 나머지 키 복사를 계속 시도한다
      ok = st.set(mealMigrateKey(sub, byN) || sub, lsGet(k, null)) && ok;
    }
  });

  if (!ok) {
    deleteTrip(t.id);
    return null;
  }

  found.forEach(lsDel);
  return t.id;
}

// 구 경비 레코드는 통화 정보가 없다({jpy}만 있다) — 당시 앱이 엔화 전용이었으므로
// 그 여행의 기본 통화(없으면 JPY)로 채운다. 이게 유일하게 옳은 추정이다.
// 일차마다 통화가 다를 수 있어(2단계-A의 일차별 도시와 같은 사정) 금액만으로는
// 나중에 환산할 수 없으므로 cur를 함께 저장한다.
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

// ---- 가져오기 검증 ----

var MAX_IMPORT_DAYS = 366;

function isISODate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// 가져온 JSON이 여행으로 쓸 만한지 본다. 문제가 있으면 사람이 읽을 수 있는
// 이유를 돌려주고, 없으면 null.
// 렌더 경로는 escHtml이 막지만, 저장 전에 구조가 깨진 값을 걸러야
// 화면이 죽거나 이상한 데이터가 영구화되는 것을 막을 수 있다.
function validateImport(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return '여행 파일이 아닙니다.';
  if (Number(o.schema) > SCHEMA) return '더 새로운 버전에서 만든 파일입니다.';
  if (!o.title || !String(o.title).trim()) return '제목이 없습니다.';
  if (!isISODate(o.start) || !isISODate(o.end)) return '날짜 형식이 올바르지 않습니다.';
  if (o.end < o.start) return '종료일이 시작일보다 빠릅니다.';
  if (o.days !== undefined && !Array.isArray(o.days)) return '일정 데이터가 올바르지 않습니다.';
  if (Array.isArray(o.days) && o.days.length > MAX_IMPORT_DAYS) return '일정이 너무 많습니다.';
  if (o.sections !== undefined && !Array.isArray(o.sections)) return '항목 데이터가 올바르지 않습니다.';
  return null;
}

// 검증을 통과한 값을 저장 가능한 Trip으로 맞춘다. 빠진 필드를 채우고 타입을
// 바로잡으며, id는 항상 새로 준다 — 같은 파일을 두 번 가져와도 기존 여행을
// 덮어쓰지 않아야 한다.
function normalizeImport(o) {
  var t = emptyTrip({
    title: String(o.title).trim(),
    start: o.start, end: o.end,
    party: Number(o.party) >= 1 ? Number(o.party) : 2,
    hotel: typeof o.hotel === "string" ? o.hotel : ""
  });
  t.budgetKRW = isFinite(Number(o.budgetKRW)) ? Number(o.budgetKRW) : 0;
  t.place = (o.place && typeof o.place === "object") ? o.place : null;
  if (o.currency && typeof o.currency === "object" && o.currency.code) t.currency = o.currency;
  t.packing = Array.isArray(o.packing) ? o.packing.filter(function (x) { return typeof x === "string"; }) : [];
  t.expenses = Array.isArray(o.expenses) ? o.expenses.filter(function (x) { return x && typeof x === "object"; }) : [];
  t.sections = Array.isArray(o.sections) ? o.sections.filter(function (x) { return x && typeof x === "object"; }) : [];

  // 일차는 기간에서 새로 만든 뒤, 가져온 값 중 날짜가 맞는 것만 얹는다.
  if (Array.isArray(o.days)) {
    var byDate = {};
    o.days.forEach(function (d) { if (d && isISODate(d.date)) byDate[d.date] = d; });
    t.days.forEach(function (d) {
      var src = byDate[d.date];
      if (!src) return;
      d.theme = typeof src.theme === "string" ? src.theme : "";
      d.place = (src.place && typeof src.place === "object") ? src.place : null;
      d.curCode = typeof src.curCode === "string" ? src.curCode : null;
      d.items = Array.isArray(src.items) ? src.items.filter(function (x) { return x && typeof x === "object"; }) : [];
      d.meals = Array.isArray(src.meals) ? src.meals : [];
      normalizeDay(d);
    });
  }
  return t;
}

// day.meals("뭐먹지" 문구)와 그 답을 담던 meal:<date>:<i> 키를 자유 메모(notes)로 옮긴다.
// 사용자가 실제로 써 둔 답이 있으면 그것을 메모로 삼고, 비어 있으면 원래 문구를 남긴다 —
// 문구도 그 여행에서 온 데이터이므로 버리지 않고, 필요 없으면 화면에서 지우면 된다.
// 재실행해도 안전하다(meals가 비면 아무 것도 하지 않는다).
function migrateMeals() {
  var changed = 0;
  listTrips().forEach(function (row) {
    var trip = loadTrip(row.id);
    if (!trip || !Array.isArray(trip.days)) return;
    var needs = trip.days.some(function (d) { return d && Array.isArray(d.meals) && d.meals.length; });
    if (!needs) return;
    var st = tripStore(row.id);
    var doomed = [];
    trip.days.forEach(function (d) {
      if (!d || !Array.isArray(d.meals) || !d.meals.length) return;
      if (!Array.isArray(d.notes)) d.notes = [];
      d.meals.forEach(function (prompt, i) {
        var key = "meal:" + String(d.date) + ":" + i;
        var answer = String(st.get(key, "") || "").trim();
        var text = answer || String(prompt == null ? "" : prompt).trim();
        if (text) d.notes.push({ id: newNoteId(), text: text });
        doomed.push(tripKey(row.id, key));
      });
      d.meals = [];
    });
    if (!saveTripBody(trip)) return;   // 저장이 실패하면 구 키를 지우지 않는다
    doomed.forEach(lsDel);
    changed++;
  });
  return changed;
}

// 구 결제 내역에는 id가 없다(엑셀에서 온 그대로였다). 편집·삭제하려면 항목을
// 가리킬 수단이 있어야 하므로 부여한다. 재실행해도 안전하다.
function migrateExpenseIds() {
  var changed = 0;
  listTrips().forEach(function (row) {
    var trip = loadTrip(row.id);
    if (!trip || !Array.isArray(trip.expenses) || !trip.expenses.length) return;
    var needs = trip.expenses.some(function (e) { return e && !e.id; });
    if (!needs) return;
    trip.expenses.forEach(function (e) { if (e && !e.id) e.id = newExpenseId(); });
    if (saveTripBody(trip)) changed++;
  });
  return changed;
}

// ---- 동행자 공유 ----
// 서버가 없으므로 여행 데이터를 링크 자체에 담는다. '#' 뒤(fragment)는 HTTP 요청에
// 실리지 않으므로 GitHub Pages 서버도 그 내용을 보지 못한다 — 데이터가 밖으로 새지
// 않는다는 뜻이다. 대신 링크를 받은 사람은 누구나 그 여행을 볼 수 있으니, 링크 자체가
// 곧 열쇠다.
//
// 페이로드 = 마커 1글자 + base64url. 마커 '1'은 deflate-raw 압축, '0'은 압축 없음
// (CompressionStream이 없는 브라우저를 위한 폴백). 마커를 두면 나중에 방식이
// 바뀌어도 예전 링크를 계속 읽을 수 있다.

function b64urlEncode(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 읽을 수 없으면 null — 남이 보낸 링크는 언제든 잘리거나 망가져 있을 수 있다.
function b64urlDecode(str) {
  try {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) {
    return null;
  }
}

// 압축 없는 경로. 동기라 테스트에서 그대로 부를 수 있다.
function packShareSync(json) {
  return '0' + b64urlEncode(new TextEncoder().encode(String(json)));
}

function unpackShareSync(payload) {
  var p = String(payload || '');
  if (p.charAt(0) !== '0') return null;
  var bytes = b64urlDecode(p.slice(1));
  if (!bytes) return null;
  try {
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return null;
  }
}

// 압축이 되면 쓰고, 안 되면 압축 없이 담는다 — 링크가 길어질 뿐 동작은 같다.
function packShare(json) {
  var raw = new TextEncoder().encode(String(json));
  if (typeof CompressionStream === 'undefined') {
    return Promise.resolve(packShareSync(json));
  }
  return new Response(
    new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  ).arrayBuffer().then(function (buf) {
    return '1' + b64urlEncode(new Uint8Array(buf));
  }).catch(function () {
    return packShareSync(json);
  });
}

function unpackShare(payload) {
  var p = String(payload || '');
  if (p.charAt(0) === '0') return Promise.resolve(unpackShareSync(p));
  if (p.charAt(0) !== '1') return Promise.resolve(null);
  var bytes = b64urlDecode(p.slice(1));
  if (!bytes || typeof DecompressionStream === 'undefined') return Promise.resolve(null);
  return new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  ).text().catch(function () { return null; });
}

// 이 길이를 넘으면 링크가 길다고 알린다. 브라우저 자체는 훨씬 긴 URL도 다루지만
// 메신저가 중간에 자르는 일이 있어, 그 전에 사용자가 알고 확인해 볼 수 있게 한다.
var SHARE_URL_WARN = 8000;

function shareHash(payload) { return '#/s/' + payload; }

function parseShareHash(hash) {
  var m = String(hash || '').match(/^#\/s\/(.+)$/);
  return m ? m[1] : null;
}

// 지금 주소에서 해시만 갈아 끼운다 — 배포 경로가 무엇이든 그대로 유지된다
// (Vercel은 루트 /, 하위 경로에 올려도 마찬가지다).
// 쿼리와 index.html은 떼어 낸다(링크는 짧을수록 메신저에서 잘 붙는다). 그 밖의
// 파일명은 그대로 둔다 — 떼면 그 주소로는 앱이 열리지 않는다.
function shareUrl(href, payload) {
  var base = String(href).split('#')[0].split('?')[0].replace(/index\.html$/, '');
  return base + shareHash(payload);
}

// 공유 링크로 받은 여행을 담는다. 남이 보낸 링크도 결국 외부 입력이므로 파일
// 가져오기와 똑같은 검증을 거치고, id는 항상 새로 준다(내 여행을 덮어쓰지 않는다).
function importShare(payload) {
  var json = unpackShareSync(payload);
  if (json === null) return { error: '공유 링크를 읽을 수 없습니다.', trip: null };
  return importShareJson(json);
}

function importShareJson(json) {
  var o;
  try { o = JSON.parse(json); }
  catch (e) { return { error: '공유 링크를 읽을 수 없습니다.', trip: null }; }
  var err = validateImport(o);
  if (err) return { error: err, trip: null };
  var trip = normalizeImport(o);
  if (!saveTrip(trip)) return { error: '저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.', trip: null };
  return { error: null, trip: trip };
}
