// 외부 조회 계층: 날씨(Open-Meteo 예보). 캐시 우선이고, 실패해도 앱은 동작한다.
// DOM에 손대지 않는다 — 다시 그리는 것은 호출부(app.js의 wxRepaint)의 몫이다.
// schema.js 다음, views.js 앞에 로드된다.

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
