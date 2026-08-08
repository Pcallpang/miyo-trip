// 외부 조회 계층: 날씨(Open-Meteo 예보). 캐시 우선이고, 실패해도 앱은 동작한다.
// DOM에 손대지 않는다 — 다시 그리는 것은 호출부(app.js의 wxRepaint)의 몫이다.
// schema.js 다음, views.js 앞에 로드된다.

var WX_DAILY = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max";
// forecast_days 상한은 16이다. 7이면 2주 넘는 여행의 뒷부분 날씨가 빈다.
var WX_DAYS = 16;

// 좌표를 캐시 키로 쓴다. 소수점 3자리(약 100m)면 같은 도시가 같은 키로 모인다.
function wxKey(place) {
  if (!place) return "";
  var la = Math.round(Number(place.lat) * 1000) / 1000;
  var lo = Math.round(Number(place.lon) * 1000) / 1000;
  if (!isFinite(la) || !isFinite(lo)) return "";
  return la + "," + lo;
}

function wxUrl(place) {
  return "https://api.open-meteo.com/v1/forecast" +
    "?latitude=" + Number(place.lat) + "&longitude=" + Number(place.lon) +
    "&daily=" + WX_DAILY +
    "&timezone=" + encodeURIComponent(place.tz || "auto") +
    "&forecast_days=" + WX_DAYS;
}

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

// 좌표별 예보 캐시. 한 여행이 여러 도시를 지날 수 있으므로 단일 전역으로는 안 된다 —
// 그러면 A 도시 예보가 B 도시 화면에 그대로 남는다.
var wxMem = {};
// 여행을 바꾸면 진행 중이던 요청의 응답이 뒤늦게 도착해 새 여행의 캐시를 덮어쓸 수 있다.
// 세대 번호를 올려 두고 응답 처리 직전에 확인해 낡은 응답을 버린다.
var wxGen = 0;
function wxResetAll() { wxMem = {}; wxGen++; }

// 같은 세션에서 방금 받아온 예보는 다시 받지 않는다(일 단위 예보라 30분이면 충분).
var WX_TTL_MS = 30 * 60 * 1000;

// 메모리 캐시 → 저장소 캐시 순으로 찾는다. 둘 다 없으면 빈 맵을 준다 —
// 화면에서는 날씨 줄이 그냥 사라진다(예보 없는 날짜와 같은 처리, 오류 문구 없음).
function wxGet(st, place) {
  var k = wxKey(place);
  if (!k) return { map: {}, at: null, live: false, fetchedAt: 0 };
  if (wxMem[k]) return wxMem[k];
  var cached = st ? st.get("wx:" + k, null) : null;
  if (cached && cached.api) {
    wxMem[k] = { map: wxDailyMap(cached.api), at: cached.at, live: false, fetchedAt: 0 };
    return wxMem[k];
  }
  return { map: {}, at: null, live: false, fetchedAt: 0 };
}

function wxIsFresh(place) {
  var e = wxMem[wxKey(place)];
  return !!e && e.live && (Date.now() - e.fetchedAt) < WX_TTL_MS;
}

// 메모리 캐시(wxMem)만 읽는다 — 호출부는 같은 렌더 안에서 wxGet(st, place)를 먼저 불러
// 캐시를 채운 뒤 이 함수를 부른다. 그 순서를 지켜야 스탬프가 뜬다.
function wxStamp(place) {
  var e = wxMem[wxKey(place)];
  if (!e || e.live || !e.at) return "";
  var d = new Date(e.at);
  var hh = ("0" + d.getHours()).slice(-2);
  var mm = ("0" + d.getMinutes()).slice(-2);
  return ' <span class="wxstamp">(' + (d.getMonth() + 1) + "/" + d.getDate() +
    " " + hh + ":" + mm + " 기준)</span>";
}

// 좌표별로 예보를 받아 캐시에 넣는다. 다 되면 onDone()을 부른다 —
// remote.js가 렌더를 알지 못하게 콜백으로 뒤집었다(1단계 리뷰의 역방향 의존 지적).
function wxRefresh(st, place, onDone) {
  var k = wxKey(place);
  if (!k) return;
  if (wxIsFresh(place)) return;
  var gen = wxGen;
  // 저장소 캐시부터 화면에 올린다(오프라인이면 이게 전부다).
  wxGet(st, place);
  fetch(wxUrl(place)).then(function (r) {
    if (!r.ok) throw new Error("wx " + r.status);
    return r.json();
  }).then(function (api) {
    if (gen !== wxGen) return;   // 그 사이 여행이 바뀌었다 — 이 응답은 버린다
    st.set("wx:" + k, { at: new Date().toISOString(), api: api });
    wxMem[k] = { map: wxDailyMap(api), at: null, live: true, fetchedAt: Date.now() };
    if (onDone) onDone();
  }).catch(function () {
    if (gen !== wxGen) return;
    // 실패해도 캐시가 있으면 다시 그린다 — 시각 스탬프가 붙어야 하기 때문이다.
    if (wxMem[k] && wxMem[k].at && onDone) onDone();
  });
}
