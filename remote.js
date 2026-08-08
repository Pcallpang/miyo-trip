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
// 진행 중인 요청의 좌표. wxIsFresh는 "응답이 도착한" 좌표만 걸러내므로, 같은 좌표로
// 연달아 부르면(여행을 열 때 showTrip이 한 번, 곧이어 showDay가 한 번) 응답 전이라
// 둘 다 요청을 보낸다. 이 표로 두 번째를 막는다.
var wxInflight = {};

function wxRefresh(st, place, onDone) {
  var k = wxKey(place);
  if (!k) return;
  if (wxIsFresh(place)) return;
  if (wxInflight[k]) return;
  wxInflight[k] = true;
  var gen = wxGen;
  // 저장소 캐시부터 화면에 올린다(오프라인이면 이게 전부다).
  wxGet(st, place);
  fetch(wxUrl(place)).then(function (r) {
    if (!r.ok) throw new Error("wx " + r.status);
    return r.json();
  }).then(function (api) {
    delete wxInflight[k];
    if (gen !== wxGen) return;   // 그 사이 여행이 바뀌었다 — 이 응답은 버린다
    st.set("wx:" + k, { at: new Date().toISOString(), api: api });
    wxMem[k] = { map: wxDailyMap(api), at: null, live: true, fetchedAt: Date.now() };
    if (onDone) onDone();
  }).catch(function () {
    delete wxInflight[k];
    if (gen !== wxGen) return;
    // 실패해도 캐시가 있으면 다시 그린다 — 시각 스탬프가 붙어야 하기 때문이다.
    if (wxMem[k] && wxMem[k].at && onDone) onDone();
  });
}

// ---- 도시 검색(지오코딩) ----

// language는 표시 언어뿐 아니라 검색 색인 자체를 고른다(2026-08-06 브라우저 실측).
// language=ko는 한국어 질의('다낭','호이안','타이베이' 8/8)와 영어 질의('Da Nang' 등
// 4/4)를 모두 받으면서 결과를 한국어로 돌려준다. 반대로 language=en은 같은 한국어
// 질의를 전부 0건으로 만든다. 그래서 ko 하나로 끝내고 폴백을 두지 않는다 —
// 폴백은 이득이 없을 뿐 아니라 한국어 사용자에게 해롭다.
function geoUrl(q, count) {
  return "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(q) + "&language=ko&count=" + (count || 5);
}

// 0건이면 응답에 results 키가 아예 없다(실측) — 빈 배열로 받는다.
function geoParse(api) {
  var rows = (api && api.results) || [];
  return rows.map(function (r) {
    return { name: r.name, country: r.country,
             lat: r.latitude, lon: r.longitude, tz: r.timezone };
  });
}

function placeLabel(place) {
  if (!place || !place.name) return "";
  return place.country ? place.name + " · " + place.country : place.name;
}

// cb(list, err). 실패해도 던지지 않는다 — 화면은 안내 문구만 바꾼다.
function geoSearch(q, cb) {
  var query = String(q || "").trim();
  if (!query) { cb([], null); return; }
  fetch(geoUrl(query, 5)).then(function (r) {
    if (!r.ok) throw new Error("geo " + r.status);
    return r.json();
  }).then(function (api) {
    cb(geoParse(api), null);
  }).catch(function () {
    cb([], '검색에 실패했습니다. 연결을 확인해 주세요.');
  });
}

// ---- 환율 ----

// KRW 기준 한 번 조회로 166개 통화를 모두 얻는다(실측). 키 불요, CORS 허용.
// rates는 "1 KRW당 해당 통화"다 — 원화 환산은 money.js의 toKRW가 뒤집어 계산한다.
var FX_URL = "https://open.er-api.com/v6/latest/KRW";
// 환율은 하루 한 번 갱신된다(time_next_update_utc 실측). 날씨의 30분과 달리 길게 잡는다.
var FX_TTL_MS = 12 * 60 * 60 * 1000;
// 무료 등급 이용 조건: "We require attribution on the pages you're using these rates".
// 앱 톤에 맞춰 눈에 띄지 않게 둬도 되지만 링크 자체는 있어야 한다.
var FX_ATTRIB_HTML =
  '<a class="fx-attrib" href="https://www.exchangerate-api.com" ' +
  'target="_blank" rel="noopener">환율 제공: Exchange Rate API</a>';

// 여행 밖 전역 키 하나 — 통화가 무엇이든 같은 응답을 쓴다.
function fxGet() {
  var v = lsGet("fx", null);
  return (v && v.rates) ? v : null;
}

// 사용자가 직접 넣은 환율은 "1단위당 원화"(예: 엔당 9원)로 저장된다.
// rates는 반대 축(1원당 통화)이므로 뒤집어서 얹는다. 0이나 음수는 무시한다.
function fxRates(st) {
  var base = fxGet();
  var out = {};
  if (base && base.rates) {
    for (var k in base.rates) {
      if (Object.prototype.hasOwnProperty.call(base.rates, k)) out[k] = base.rates[k];
    }
  }
  var manual = st ? st.get("fxManual", null) : null;
  if (manual) {
    for (var c in manual) {
      if (!Object.prototype.hasOwnProperty.call(manual, c)) continue;
      var krwPerUnit = Number(manual[c]);
      if (isFinite(krwPerUnit) && krwPerUnit > 0) out[c] = 1 / krwPerUnit;
    }
  }
  return out;
}

function fxIsFresh() {
  var v = fxGet();
  if (!v || !v.fetchedAt) return false;
  return (Date.now() - v.fetchedAt) < FX_TTL_MS;
}

var fxInflight = false;

// 캐시 우선. 실패해도 조용히 넘어간다 — 수동 입력이 항상 있으므로 앱은 계속 동작한다.
function fxRefresh(onDone) {
  if (fxIsFresh() || fxInflight) return;
  fxInflight = true;
  fetch(FX_URL).then(function (r) {
    if (!r.ok) throw new Error("fx " + r.status);
    return r.json();
  }).then(function (api) {
    fxInflight = false;
    if (!api || api.result !== "success" || !api.rates) return;
    lsSet("fx", { at: api.time_last_update_utc || new Date().toISOString(),
                  fetchedAt: Date.now(), rates: api.rates });
    if (onDone) onDone();
  }).catch(function () {
    fxInflight = false;
  });
}
