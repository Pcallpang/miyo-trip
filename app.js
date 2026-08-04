// 날씨 조회 + 해시 라우터. 렌더는 views.js에 있다.

function todayLocal() {
  var d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

var WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=34.69&longitude=135.5" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
  "&timezone=Asia%2FTokyo&forecast_days=7";

function wxIcon(code) {
  if (code === 0) return { e: "☀️", t: "맑음" };
  if (code === 1 || code === 2) return { e: "🌤️", t: "구름 조금" };
  if (code === 3) return { e: "☁️", t: "흐림" };
  if (code === 45 || code === 48) return { e: "🌫️", t: "안개" };
  if (code >= 51 && code <= 57) return { e: "🌦️", t: "이슬비" };
  if (code >= 61 && code <= 67) return { e: "🌧️", t: "비" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { e: "🌨️", t: "눈" };
  if (code >= 80 && code <= 82) return { e: "🌧️", t: "소나기" };
  if (code >= 95) return { e: "⛈️", t: "뇌우" };
  return { e: "🌡️", t: "" };
}
function wxDailyMap(api) {
  var m = {};
  if (!api || !api.daily || !api.daily.time) return m;
  api.daily.time.forEach(function (d, i) {
    var rain = api.daily.precipitation_probability_max[i];
    m[d] = {
      code: api.daily.weather_code[i],
      tmax: Math.round(api.daily.temperature_2m_max[i]),
      tmin: Math.round(api.daily.temperature_2m_min[i]),
      rain: (rain === null || rain === undefined) ? null : rain
    };
  });
  return m;
}
function wxLine(map, date) {
  var w = map[date];
  if (!w) return "";
  var rain = w.rain === null ? "" : " · 비 " + w.rain + "%";
  return wxIcon(w.code).e + " " + w.tmax + "° / " + w.tmin + "°" + rain;
}

var wxState = { map: {}, at: null, live: false, fetchedAt: 0 };
// 여행이 바뀌면 이전 여행의 날씨가 남아 첫 페인트에 엉뚱한 도시가 보인다(지금은
// WX_URL이 좌표를 고정하고 있어 안 보이지만, 좌표가 여행별이 되는 순간 버그가 된다).
function wxReset() {
  wxState = { map: {}, at: null, live: false, fetchedAt: 0 };
}
// 같은 세션에서 방금 받아온 예보는 다시 받지 않는다(일 단위 예보라 30분이면 충분).
var WX_TTL_MS = 30 * 60 * 1000;
function wxIsFresh() {
  return wxState.live && (Date.now() - wxState.fetchedAt) < WX_TTL_MS;
}

function wxStamp() {
  if (wxState.live || !wxState.at) return "";
  var d = new Date(wxState.at);
  var hh = ("0" + d.getHours()).slice(-2);
  var mm = ("0" + d.getMinutes()).slice(-2);
  return ' <span class="wxstamp">(' + (d.getMonth() + 1) + "/" + d.getDate() +
    " " + hh + ":" + mm + " 기준)</span>";
}
function wxRefresh(st) {
  if (wxIsFresh()) return;
  var cached = st.get("weather", null);
  if (cached && cached.api) {
    wxState.map = wxDailyMap(cached.api);
    wxState.at = cached.at;
  }
  fetch(WX_URL).then(function (r) {
    if (!r.ok) throw new Error("wx " + r.status);
    return r.json();
  }).then(function (api) {
    var map = wxDailyMap(api);
    st.set("weather", { at: new Date().toISOString(), api: api });
    wxState.map = map;
    wxState.at = null;
    wxState.live = true;
    wxState.fetchedAt = Date.now();
    wxRepaint();
  }).catch(function () {
    if (wxState.at) wxRepaint();
  });
}
// 날씨가 바뀌면 날씨를 쓰는 화면(요약·타임라인)만 다시 그린다.
// showTrip 전체를 다시 부르면 renderTabs의 scrollIntoView로 스크롤이 튀고
// renderFixed가 열려 있던 아코디언(details)과 입력 중이던 값을 날린다.
function wxRepaint() {
  if (!CUR.trip) return;
  if (document.getElementById("screen-trip").hidden) return;
  renderSummary(CUR.trip, CUR.st);
  var day = pickDay(CUR.trip, CUR.dayN);
  if (day) renderTimeline(CUR.trip, day, CUR.st);
}

// ---- 라우터 ----

var CUR = { id: null, trip: null, st: null, dayN: null };

function currentTrip() { return CUR.trip; }

function go(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

function showScreen(which) {
  ["list", "trip", "edit"].forEach(function (s) {
    document.getElementById("screen-" + s).hidden = (s !== which);
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
    if (!Array.isArray(day.items)) day.items = [];
    renderTimeline(trip, day, CUR.st);
  } else {
    document.getElementById("daytabs").innerHTML = '';
    document.getElementById("timeline").innerHTML =
      '<p class="empty">표시할 일정이 없습니다.</p>';
  }
}

function showTrip(id, dayN) {
  var trip = loadTrip(id);
  if (!trip) { go('#/'); return; }
  // 여행을 "여는" 경우에만 화면 전체를 세운다: 다른 여행으로 바뀌었거나,
  // 목록·편집 등 다른 화면에서 돌아온 경우. 같은 여행 안에서 일차 탭만 누른
  // 경우에는 showDay만 돈다.
  var switched = (CUR.id !== id);
  var opening = switched || document.getElementById("screen-trip").hidden;

  CUR.id = id; CUR.trip = trip; CUR.st = tripStore(id);
  if (switched) wxReset();
  showScreen("trip");

  if (opening) renderSummary(trip, CUR.st);
  showDay(trip, dayN);
  if (opening) {
    renderFixed(trip, CUR.st);
    // 날씨 요청은 여행을 열 때만, 그것도 최근에 받아온 게 없을 때만 보낸다.
    wxRefresh(CUR.st);
  }
}

function route() {
  var h = location.hash || "#/";
  var m = h.match(/^#\/t\/([^/]+)(?:\/d\/(\d+))?$/);
  if (m) { showTrip(m[1], m[2] ? parseInt(m[2], 10) : null); return; }
  if (/^#\/t\/[^/]+\/edit$/.test(h)) { showEdit(h.split('/')[2]); return; }
  if (h === "#/new") { showEdit(null); return; }
  showList();
}

window.addEventListener("hashchange", route);

document.addEventListener("DOMContentLoaded", function () {
  // 앱 화면이 없는 페이지(test.html 등)에서는 부팅하지 않는다.
  if (!document.getElementById("screen-list")) return;
  migrateLegacy();

  document.getElementById("new-trip")
    .addEventListener("click", function () { go('#/new'); });
  document.getElementById("add-sample")
    .addEventListener("click", function () { go('#/t/' + installSample()); });

  // 여행이 하나뿐이면 목록을 건너뛰고 바로 연다.
  var trips = listTrips();
  if (!location.hash && trips.length === 1) { go('#/t/' + trips[0].id); return; }
  route();
});
