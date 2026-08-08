// 해시 라우터와 부팅. 렌더는 views.js, 외부 조회는 remote.js에 있다.

function todayLocal() {
  var d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// dayN에 해당하는 day를 찾아 타임라인만 다시 그린다. renderTabs(따라서 tab strip의
// scrollIntoView)는 건드리지 않는다 — 탭 목록이나 선택된 탭이 바뀌지 않은 상황(날씨 갱신,
// 편집 모드 토글)에서 renderTabs까지 다시 부르면 스크롤이 제자리서 튄다.
// 손상된 저장값 보정(normalizeDay)도 여기서 함께 한다 — renderTimeline을 직접 부르는
// 경로(wxRepaint, 편집 모드 토글, afterItemEdit)가 전부 이 보정을 거치게 해서,
// items/date/text가 망가진 day를 만나도 던지지 않는다.
function repaintDay(trip, dayN, st) {
  var day = pickDay(trip, dayN);
  if (!day) return null;
  renderTimeline(trip, day, st);
  return day;
}

// 날씨가 바뀌면 날씨를 쓰는 화면(요약·타임라인)만 다시 그린다.
// showTrip 전체를 다시 부르면 renderTabs의 scrollIntoView로 스크롤이 튀고
// 패널(#tab-panel)이 열려 있던 아코디언과 입력 중이던 값을 날린다.
function wxRepaint() {
  if (!CUR.trip) return;
  if (document.getElementById("screen-trip").hidden) return;
  renderSummary(CUR.trip, CUR.st);
  repaintDay(CUR.trip, CUR.dayN, CUR.st);
}

// ---- 라우터 ----

var CUR = { id: null, trip: null, st: null, dayN: null, tab: "day" };

function currentTrip() { return CUR.trip; }

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function showScreen(which) {
  ["list", "trip", "edit"].forEach(function (s) {
    document.getElementById("screen-" + s).hidden = (s !== which);
  });
}

// 가져온 JSON을 검증해 저장한다. 결과 메시지를 돌려준다(성공이면 null).
// 파일 하나가 잘못돼도 앱은 그대로 동작해야 하므로 던지지 않는다.
function importTripJson(text) {
  var o;
  try { o = JSON.parse(text); }
  catch (e) { return '파일을 읽을 수 없습니다. 여행 파일이 맞는지 확인해 주세요.'; }
  var err = validateImport(o);
  if (err) return err;
  var trip = normalizeImport(o);
  if (!saveTrip(trip)) return '저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.';
  return null;
}

function showList() {
  showScreen("list");
  var trips = listTrips();
  document.getElementById("triplist").innerHTML = trips.length
    ? trips.map(function (t) {
        return '<article class="tripcard" data-id="' + escHtml(t.id) + '">' +
          '<div class="tc-title">' + escHtml(t.title) + '</div>' +
          '<div class="tc-period">' + escHtml(t.start) + ' ~ ' + escHtml(t.end) + '</div>' +
          '<div class="tc-dday">' + dday(todayLocal(), t.start, t.end) + '</div>' +
          '<button class="tc-del" type="button" aria-label="삭제">×</button></article>';
      }).join('')
    : '<p class="empty">아직 여행이 없습니다. 새로 만들어 보세요.</p>';

  var list = document.getElementById("triplist");
  list.querySelectorAll('.tripcard').forEach(function (c) {
    c.addEventListener('click', function (e) {
      // closest: 삭제 버튼이 나중에 아이콘 같은 자식을 갖게 돼도 그대로 동작한다.
      if (e.target.closest('.tc-del')) return;
      go('#/t/' + c.dataset.id);
    });
  });
  list.querySelectorAll('.tc-del').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = b.closest('.tripcard');
      var name = card.querySelector('.tc-title').textContent;
      if (!confirm('"' + name + '" 여행을 삭제할까요? 되돌릴 수 없습니다.')) return;
      deleteTrip(card.dataset.id);
      showList();
    });
  });
}

// 그릴 일차를 고른다. 요청한 일차가 없거나(손상된 JSON을 가져온 경우 등)
// days 자체가 비어 있으면 던지지 않고 대신 오늘 → 첫날/마지막날 순으로 물러난다.
// 고를 수 있는 일차가 하나도 없으면 null.
// todayISO는 테스트에서 주입하기 위한 선택 인자다. 비우면 오늘 날짜를 쓴다.
function pickDay(trip, dayN, todayISO) {
  var days = (trip && Array.isArray(trip.days)) ? trip.days : [];
  // 손상된 저장값 보정은 고르기 전에, 그리고 고른 일차뿐 아니라 모든 일차에 대해 한다 —
  // 탭 목록(renderTabs)은 선택되지 않은 일차의 date까지 읽으므로(d.date.slice(5)),
  // 고른 일차만 보정해서는 date가 없는 다른 일차 하나 때문에 화면 전체가 죽는다.
  days.forEach(normalizeDay);
  if (!days.length) return null;
  var day = null;
  if (dayN) day = days.filter(function (d) { return d.n === dayN; })[0];
  var today = todayISO || todayLocal();
  if (!day) day = days.filter(function (d) { return d.date === today; })[0];
  if (!day) day = today < days[0].date ? days[0] : days[days.length - 1];
  return day || null;
}

// 일차만 바뀔 때 다시 그리는 것: 탭 + 타임라인. 그게 전부다.
// #fixed(고정 정보·짐·경비)는 건드리지 않는다 — innerHTML을 통째로 갈아엎으면
// 열어 둔 아코디언이 닫히고 경비 입력창에 치던 값이 사라진다.
function showDay(trip, dayN) {
  var day = pickDay(trip, dayN);
  CUR.dayN = day ? day.n : null;
  if (day) {
    renderTabs(trip, day.n, function (n) { go('#/t/' + trip.id + '/d/' + n); });
    renderTimeline(trip, day, CUR.st);
    // 그 일차만 다른 도시일 수 있다 — 여행을 열 때 받아 둔 좌표와 다르면 여기서 받는다.
    // wxRefresh는 이미 받아 둔 좌표면 곧바로 반환하므로 일차를 오갈 때 요청이 늘지 않는다.
    var dp = dayPlace(trip, day);
    if (dp) wxRefresh(CUR.st, dp, wxRepaint);
  } else {
    document.getElementById("daytabs").innerHTML = '';
    document.getElementById("timeline").innerHTML =
      '<p class="empty">표시할 일정이 없습니다.</p>';
  }
}

function showTrip(id, tab, dayN) {
  // 여행을 "여는" 경우에만 화면 전체를 세운다: 다른 여행으로 바뀌었거나,
  // 목록·편집 등 다른 화면에서 돌아온 경우. 같은 여행 안에서 탭이나 일차만
  // 누른 경우에는 showPanelTab만 돈다.
  var switched = (CUR.id !== id);
  var opening = switched || document.getElementById("screen-trip").hidden;

  // 여는 경우에만 저장소에서 다시 읽는다. 일차·탭 전환에서까지 loadTrip을 부르면
  // CUR.trip이 매번 새 객체로 갈아치워지는데, #summary는 여는 경로에서만
  // 다시 그려지므로 그 핸들러들은 "이전에 불러온" trip을 계속 붙들고 있게 된다.
  // 그 상태에서 편집 토글(renderSummary→repaintDay)을 누르면 타임라인 전체가 낡은
  // 스냅샷에 다시 묶이고, 그 뒤의 addItem/updateItem/removeItem + saveTripBody(trip)이
  // 탭 전환 이후 저장된 일정을 통째로 덮어써 지운다(실제로 재현됨).
  // 여는 경로는 항상 #summary를 함께 다시 그리므로, 그때만 다시 읽으면
  // 화면 위의 모든 핸들러가 언제나 CUR.trip 하나만 붙들게 된다.
  // 덤으로 탭을 누를 때마다 돌던 JSON.parse 한 번이 사라진다.
  var trip = opening ? loadTrip(id) : CUR.trip;
  if (!trip) { go('#/'); return; }

  CUR.id = id; CUR.trip = trip; CUR.st = tripStore(id);
  // EDIT_MODE는 세션에 묶인 UI 상태일 뿐 trip 데이터가 아니다(views.js 위 주석 참고) —
  // 다른 여행으로 전환하면서 편집 모드가 그대로 넘어가면, A에서 편집 모드를 켠 채 목록으로
  // 돌아가 B를 열었을 때 B가 편집 모드로 열려버린다. 새로고침은 전역 변수 자체가 초기화되며
  // 자연히 꺼지므로 여기서는 "여행이 바뀌는" 경우만 챙기면 된다.
  if (switched) { wxResetAll(); EDIT_MODE = false; }
  showScreen("trip");

  if (opening) renderSummary(trip, CUR.st);
  showPanelTab(trip, tab || "day", dayN);
  // 날씨 요청은 여행을 열 때만, 그것도 최근에 받아온 게 없을 때만 보낸다.
  // 좌표는 지금 보고 있는 일차 기준이다(일차마다 도시가 다를 수 있다).
  if (opening) {
    var d0 = pickDay(trip, CUR.dayN);
    var p0 = d0 ? dayPlace(trip, d0) : trip.place;
    if (p0) wxRefresh(CUR.st, p0, wxRepaint);
  }
}

// 탭 전환: 본문과 내비만 다시 그린다. 요약 헤더는 탭이 실제로 바뀔 때만 —
// 편집 토글이 일정 탭에서만 보여야 하기 때문이다. 화면 전체를 다시 그리면
// 열어둔 것이 닫히고 입력 중이던 값이 날아간다.
function showPanelTab(trip, tab, dayN) {
  var prev = CUR.tab;
  CUR.tab = tab;
  // renderPanel/renderTabbar와 같은 계약 — 컨테이너가 없는 페이지(test.html 등)에서도
  // 던지지 않는다.
  var dayEl = document.getElementById("tab-day");
  var panelEl = document.getElementById("tab-panel");
  if (dayEl) dayEl.hidden = (tab !== "day");
  if (panelEl) panelEl.hidden = (tab === "day");
  if (tab === "day") showDay(trip, dayN);
  else renderPanel(trip, CUR.st, tab);
  renderTabbar(trip, tab, function (t) { go(tabHash(trip.id, t, CUR.dayN)); });
  if (prev !== tab) renderSummary(trip, CUR.st);
}

var TAB_DEFS = [
  { key: "day",     icon: "🗓", label: "일정" },
  { key: "hotel",   icon: "🏨", label: "숙소" },
  { key: "packing", icon: "🎒", label: "준비물" },
  { key: "money",   icon: "💰", label: "경비" },
  { key: "info",    icon: "ℹ️", label: "정보" }
];
var TAB_KEYS = TAB_DEFS.map(function (t) { return t.key; });

// 여행 화면 해시를 {id, tab, dayN}으로. 여행 화면이 아니면 null.
// /edit은 일부러 안 잡는다 — 라우터가 별도 분기로 처리한다.
function parseTripHash(hash) {
  var m = String(hash || "").match(
    /^#\/t\/([^/]+)(?:\/(?:d\/(\d+)|(hotel|packing|money|info)))?$/);
  if (!m) return null;
  if (m[2]) return { id: m[1], tab: "day", dayN: parseInt(m[2], 10) };
  return { id: m[1], tab: m[3] || "day", dayN: null };
}

function tabHash(id, tab, dayN) {
  if (tab !== "day") return '#/t/' + id + '/' + tab;
  return dayN ? '#/t/' + id + '/d/' + dayN : '#/t/' + id;
}

function route() {
  var h = location.hash || "#/";
  var t = parseTripHash(h);
  if (t) { showTrip(t.id, t.tab, t.dayN); return; }
  if (/^#\/t\/[^/]+\/edit$/.test(h)) { showEdit(h.split('/')[2]); return; }
  if (h === "#/new") { showEdit(null); return; }
  showList();
}

window.addEventListener("hashchange", route);

document.addEventListener("DOMContentLoaded", function () {
  // 앱 화면이 없는 페이지(test.html 등)에서는 부팅하지 않는다.
  if (!document.getElementById("screen-list")) return;
  migrateLegacy();
  // 식사 메모 키를 일차 번호 기준에서 날짜 기준으로 옮긴다(store.js 주석 참고).
  // migrateLegacy 뒤에 두지만, 어느 쪽이 먼저 돌아도 결과가 같도록 설계돼 있다.
  migrateMealKeys();
  // 내장 섹션은 하단 탭이 됐다 — 데이터에 남아 있던 항목을 걷어낸다.
  migrateSections();
  // 경비 레코드에 통화를 붙인다(구 {jpy} → {amount, cur}).
  migrateSpend();
  // 뭐먹지(meals)를 자유 메모(notes)로 옮긴다.
  migrateMeals();

  document.getElementById("new-trip")
    .addEventListener("click", function () { go('#/new'); });

  var imp = document.getElementById("import-trip");
  var impInput = document.getElementById("import-file");
  if (imp && impInput) {
    imp.addEventListener("click", function () { impInput.click(); });
    impInput.addEventListener("change", function () {
      var file = (impInput.files || [])[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var err = importTripJson(String(reader.result));
        impInput.value = '';
        if (err) { alert(err); return; }
        showList();
      };
      reader.onerror = function () {
        impInput.value = '';
        alert('파일을 읽을 수 없습니다.');
      };
      reader.readAsText(file);
    });
  }
  document.getElementById("add-sample")
    .addEventListener("click", function () {
      // installSample은 저장 실패 시 null을 돌려준다 — 그대로 이동하면 showTrip이
      // 여행을 찾지 못해 목록으로 조용히 튕겨 나가고, 사용자는 아무 설명도 못 받는다.
      var id = installSample();
      if (!id) {
        alert('샘플 여행을 저장하지 못했습니다. 기기 저장 공간을 확인해 주세요.');
        return;
      }
      go('#/t/' + id);
    });

  // 여행이 하나뿐이면 목록을 건너뛰고 바로 연다.
  var trips = listTrips();
  if (!location.hash && trips.length === 1) { go('#/t/' + trips[0].id); return; }
  route();
});
