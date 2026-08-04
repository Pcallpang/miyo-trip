// 날씨 조회 + 부팅. 렌더는 views.js에 있다.

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

var wxState = { map: {}, at: null, live: false };
var currentDayN = null;

function wxStamp() {
  if (wxState.live || !wxState.at) return "";
  var d = new Date(wxState.at);
  var hh = ("0" + d.getHours()).slice(-2);
  var mm = ("0" + d.getMinutes()).slice(-2);
  return ' <span class="wxstamp">(' + (d.getMonth() + 1) + "/" + d.getDate() +
    " " + hh + ":" + mm + " 기준)</span>";
}
function wxRefresh(st) {
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
    wxRepaint();
  }).catch(function () {
    if (wxState.at) wxRepaint();
  });
}
function wxRepaint() {
  if (!bootTrip) return;
  renderSummary(bootTrip, bootSt);
  if (currentDayN !== null) selectDay(currentDayN);
}

// ---- 부팅 ----
// Task 6의 라우터가 오기 전까지 쓰는 임시 코드다. 여행 하나를 그대로 그린다.

var bootTrip = null;
var bootSt = null;

// 기존 osaka-trip:v1: 키를 그대로 쓰는 tripStore 모양의 어댑터.
// 라우터가 붙으면 migrateLegacy() + tripStore(id)로 대체된다.
var LEGACY_ST = {
  get: function (k, fb) { return lsGet("osaka-trip:v1:" + k, fb); },
  set: function (k, v) { return lsSet("osaka-trip:v1:" + k, v); }
};

function selectDay(n) {
  currentDayN = n;
  var day = bootTrip.days.find(function (d) { return d.n === n; });
  renderTabs(bootTrip, n, selectDay);
  renderTimeline(bootTrip, day, bootSt);
}

document.addEventListener("DOMContentLoaded", function () {
  bootTrip = window.SAMPLE_TRIP;
  bootSt = LEGACY_ST;
  if (!bootTrip) return;

  wxRefresh(bootSt);

  var days = bootTrip.days;
  var today = todayLocal();
  var initial = days.find(function (d) { return d.date === today; });
  if (!initial) initial = today < days[0].date ? days[0] : days[days.length - 1];
  selectDay(initial.n);

  renderFixed(bootTrip, bootSt);
  renderSummary(bootTrip, bootSt);
});
