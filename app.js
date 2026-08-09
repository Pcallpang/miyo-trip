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

// 환율이 새로 들어오면 원화 환산을 쓰는 화면만 다시 그린다(wxRepaint와 같은 사정 —
// showTrip 전체를 다시 부르면 스크롤이 튀고 열어 둔 것이 닫힌다).
function fxRepaint() {
  if (!CUR.trip) return;
  if (document.getElementById("screen-trip").hidden) return;
  renderSummary(CUR.trip, CUR.st);
  if (CUR.tab === "day") repaintDay(CUR.trip, CUR.dayN, CUR.st);
  else if (CUR.tab === "money") renderPanel(CUR.trip, CUR.st, "money");
}

// ---- 라우터 ----

var CUR = { id: null, trip: null, st: null, dayN: null, tab: "day" };

function currentTrip() { return CUR.trip; }

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function showScreen(which) {
  ["list", "trip", "edit", "share"].forEach(function (s) {
    var el = document.getElementById("screen-" + s);
    if (el) el.hidden = (s !== which);
  });
}

// 공유 링크로 들어온 화면. 바로 담지 않고 무엇이 담기는지 먼저 보여준다 —
// 링크 하나로 남의 여행이 내 목록에 소리 없이 늘어나면 곤란하다.
function showShare(payload) {
  showScreen("share");
  var el = document.getElementById("screen-share");
  el.innerHTML = '<div class="sh-wrap"><p class="sh-load">여행을 읽는 중…</p></div>';

  unpackShare(payload).then(function (json) {
    var o = null;
    if (json !== null) { try { o = JSON.parse(json); } catch (e) { o = null; } }
    var err = o === null ? '공유 링크를 읽을 수 없습니다.' : validateImport(o);
    if (err) {
      el.innerHTML = '<div class="sh-wrap">' +
        '<h1 class="sh-h">여행을 담을 수 없습니다</h1>' +
        '<p class="sh-msg">' + escHtml(err) + '</p>' +
        '<p class="sh-hint">링크가 중간에 잘렸을 수 있습니다. 보낸 사람에게 다시 받아 보세요.</p>' +
        '<button class="sh-cancel" type="button">내 여행 목록으로</button></div>';
    } else {
      var days = Array.isArray(o.days) ? o.days.length : 0;
      var items = 0;
      (Array.isArray(o.days) ? o.days : []).forEach(function (d) {
        if (d && Array.isArray(d.items)) items += d.items.length;
      });
      el.innerHTML = '<div class="sh-wrap">' +
        '<p class="sh-eyebrow">공유받은 여행</p>' +
        '<h1 class="sh-h">' + escHtml(o.title) + '</h1>' +
        '<p class="sh-msg">' + escHtml(o.start) + ' ~ ' + escHtml(o.end) +
          ' · ' + escHtml(nightsLabel(o.start, o.end)) + '</p>' +
        '<p class="sh-msg">' + days + '일차 · 일정 ' + items + '개</p>' +
        '<button class="sh-go" type="button">내 여행에 담기</button>' +
        '<button class="sh-cancel" type="button">담지 않기</button>' +
        '<p class="sh-hint">담은 뒤에는 내 여행이 됩니다 — 보낸 사람이 나중에 고친 내용은 ' +
          '따라오지 않습니다.</p></div>';
      el.querySelector('.sh-go').addEventListener('click', function () {
        var res = importShareJson(json);
        if (res.error) { alert(res.error); return; }
        go('#/t/' + res.trip.id);
      });
    }
    var cancel = el.querySelector('.sh-cancel');
    if (cancel) cancel.addEventListener('click', function () { go('#/'); });
  });
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
    : '<div class="empty">' + miyoImg(MIYO.empty, 'miyo-lg') +
      '<p>아직 여행이 없습니다. 새로 만들어 보세요.</p></div>';

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
  if (switched) { wxResetAll(); }
  showScreen("trip");

  if (opening) renderSummary(trip, CUR.st);
  showPanelTab(trip, tab || "day", dayN);
  // 날씨 요청은 여행을 열 때만, 그것도 최근에 받아온 게 없을 때만 보낸다.
  // 좌표는 지금 보고 있는 일차 기준이다(일차마다 도시가 다를 수 있다).
  if (opening) {
    var d0 = pickDay(trip, CUR.dayN);
    var p0 = d0 ? dayPlace(trip, d0) : trip.place;
    if (p0) wxRefresh(CUR.st, p0, wxRepaint);
    // 환율도 여행을 열 때 받아 둔다. 캐시가 신선하면(12시간) 아무 것도 하지 않으므로
    // 여행을 오갈 때 요청이 늘지 않는다. 실패해도 조용히 넘어간다 — 수동 입력이 있다.
    fxRefresh(fxRepaint);
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

// 아이콘은 미요 캐릭터다(views.js의 MIYO 참고) — 탭마다 다른 캐릭터를 세워
// 어느 탭인지 색과 모양으로 먼저 알아보게 한다.
var TAB_DEFS = [
  { key: "day",     miyo: "nep-miyo",       label: "일정" },
  { key: "hotel",   miyo: "pingp-miyo",     label: "숙소" },
  { key: "packing", miyo: "yarr-miyo",      label: "준비물" },
  { key: "money",   miyo: "ppak-miyo",      label: "경비" },
  { key: "info",    miyo: "tip-miyo",       label: "정보" }
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
  var payload = parseShareHash(h);
  if (payload) { showShare(payload); return; }
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
  // 구 결제 내역에 id를 부여한다(편집하려면 항목을 가리킬 수단이 필요하다).
  migrateExpenseIds();
  // 사진 첨부 기능을 걷어냈다 — 예전에 붙인 사진이 IndexedDB에 남아 용량만 차지하므로
  // 한 번 지운다. 없거나 막힌 환경(file://)에서는 조용히 넘어간다.
  try { if (window.indexedDB) indexedDB.deleteDatabase("trip-images"); } catch (e) {}

  document.getElementById("new-trip")
    .addEventListener("click", function () { go('#/new'); });

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
