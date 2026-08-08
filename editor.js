// 여행 만들기·설정, 일정 편집 (Task 7-8)

var MAX_TRIP_DAYS = 90;

function validateTripForm(f) {
  if (!f.title || !f.title.trim()) return '여행 제목을 입력하세요.';
  if (!f.start || !f.end) return '시작일과 종료일을 입력하세요.';
  if (f.end < f.start) return '종료일이 시작일보다 빠릅니다.';
  // <input type=date>는 연도 자릿수를 제한하지 않아(예: 275760년) Date.parse가 NaN을
  // 돌려줄 수 있다. NaN > 90은 false라서 그대로 두면 "통과"해버리고 resyncDays가
  // 일차 0개짜리 여행을 만든다 — 기간이 긴 게 아니라 날짜 자체가 무효인 것이므로
  // "최대 90일" 메시지 대신 별도 메시지로 구분한다.
  var days = daysBetween(f.start, f.end);
  if (!(days >= 1)) return '날짜가 올바르지 않습니다.';
  if (days > MAX_TRIP_DAYS) return '여행 기간은 최대 90일입니다.';
  if (!(Number(f.party) >= 1)) return '인원은 1명 이상이어야 합니다.';
  return null;
}

// trip이 null이면 새로 만들고, 있으면 필드를 갱신한 새 객체를 돌려준다. days는 항상
// 재동기화한다.
// 참고(편집 경로): 인자로 받은 trip은 건드리지 않는다(non-mutating) — 갱신된 필드를
// 얹은 새 객체를 돌려준다. showEdit는 폼 제출마다 이 함수에 같은 trip 참조를 넘기는데,
// 만약 그 자리에서 고쳤다면 실패한 시도의 값(예: 일차가 줄어들며 사라진 일정)이 메모리
// 위 trip에 그대로 남아, 그다음 재시도가 성공할 때 저장소의 온전한 값이 아니라 실패한
// 시도로 오염된 값을 써버린다. trip을 그대로 두면 재시도할 때마다 항상 저장소와 일치하는
// 원본에서 다시 시작하므로 이 문제가 애초에 생기지 않는다. saveTrip이 실패해도 caller가
// 들고 있는 trip은 여전히 저장소와 일치한다 — 그래도 submitTripForm은 실패 시 절대
// navigate하지 않고 에러를 보여준다(아래 참고).
function applyTripForm(trip, f) {
  if (!trip) {
    var made = emptyTrip({ title: f.title.trim(), start: f.start, end: f.end,
                           party: Number(f.party), hotel: (f.hotel || '').trim() });
    // f.place가 undefined면 도시를 건드리지 않은 저장이다(기본값 null 유지).
    if (f.place !== undefined) made.place = f.place;
    if (f.currency !== undefined) made.currency = f.currency;
    if (f.countryCode !== undefined) made.countryCode = f.countryCode;
    return made;
  }
  var next = {};
  for (var k in trip) { if (Object.prototype.hasOwnProperty.call(trip, k)) next[k] = trip[k]; }
  next.title = f.title.trim();
  next.start = f.start;
  next.end = f.end;
  next.party = Number(f.party);
  next.hotel = (f.hotel || '').trim();
  // 도시를 건드리지 않은 저장(f.place === undefined)에서는 기존 값을 그대로 둔다.
  if (f.place !== undefined) next.place = f.place;
  if (f.currency !== undefined) next.currency = f.currency;
  if (f.countryCode !== undefined) next.countryCode = f.countryCode;
  next.days = resyncDays(trip.days, f.start, f.end);
  // 일차별 도시는 resyncDays 뒤에 적용한다 — 기간이 바뀌면 일차 번호가 다시 매겨지므로
  // 그 전에 적용하면 엉뚱한 날에 붙는다. {dayN: place|null} 형태다.
  if (f.dayPlaces) {
    for (var dn in f.dayPlaces) {
      if (Object.prototype.hasOwnProperty.call(f.dayPlaces, dn)) {
        setDayPlace(next, Number(dn), f.dayPlaces[dn]);
      }
    }
  }
  return next;
}

// 검증 → 적용 → 저장까지의 순수 로직. DOM에 손대지 않아 테스트에서 직접 호출할 수 있다.
// saveTrip은 localStorage 쓰기가 실제로 반영됐는지 읽어서 확인한 boolean을 돌려주므로
// (용량 초과·프라이빗 모드 등에서 조용히 no-op일 수 있음) 그 값을 무시하면 실패가
// 사용자에게 전혀 드러나지 않는다 — 새 여행이면 존재하지 않는 화면으로 이동해버리고,
// 수정이면 저장 안 된 새 값이 화면에 남아 성공한 것처럼 보인다.
function submitTripForm(trip, f) {
  var err = validateTripForm(f);
  if (err) return { ok: false, message: err };
  var saved = applyTripForm(trip, f);
  if (!saveTrip(saved)) {
    return { ok: false, message: '저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.', trip: saved };
  }
  return { ok: true, trip: saved };
}

function showEdit(id) {
  var trip = id ? loadTrip(id) : null;
  if (id && !trip) { go('#/'); return; }
  var el = document.getElementById("screen-edit");
  showScreen("edit");

  el.innerHTML =
    '<header class="ehead"><button id="e-back" type="button">←</button>' +
    '<h1>' + (trip ? '여행 설정' : '새 여행') + '</h1></header>' +
    '<form id="trip-form" class="eform">' +
      '<label>제목<input name="title" type="text" required placeholder="예: 오사카 여행" ' +
        'value="' + escHtml(trip ? trip.title : '') + '"></label>' +
      '<label>시작일<input name="start" type="date" required ' +
        'value="' + escHtml(trip ? trip.start : '') + '"></label>' +
      '<label>종료일<input name="end" type="date" required ' +
        'value="' + escHtml(trip ? trip.end : '') + '"></label>' +
      '<label>인원<input name="party" type="number" min="1" step="1" ' +
        'value="' + (trip ? Number(trip.party) : 2) + '"></label>' +
      '<label>숙소<textarea name="hotel" rows="2" ' +
        'placeholder="숙소명 · 체크인/아웃">' + escHtml(trip ? trip.hotel : '') + '</textarea></label>' +
      // 나라를 고르면 통화가 따라온다 — 통화 코드를 외우는 것보다 자연스럽다.
      // 통화는 표시만 하고 값은 나라에서 끌어온다(둘이 어긋날 수 없다).
      '<label>나라<select name="country">' +
        '<option value="">— 선택 —</option>' +
        COUNTRIES.map(function (c) {
          var on = (trip && trip.countryCode) === c.cc ? ' selected' : '';
          return '<option value="' + escHtml(c.cc) + '"' + on + '>' + escHtml(c.name) + '</option>';
        }).join('') +
      '</select></label>' +
      '<div class="cur-line" id="cur-line"></div>' +
      // 도시는 폼 필드가 아니라 검색으로 고른다 — 선택값은 pickedPlace에 담아두고
      // 저장할 때 함께 넘긴다(취소하면 반영되지 않는다).
      // 나라를 고르면 그 나라 도시 목록에서 고른다(좌표가 붙어 날씨가 바로 온다).
      // 목록에 없는 곳은 '직접 입력'으로 이름을 적고 검색해서 고르면 된다.
      '<div class="geo-block">' +
        '<div class="geo-lbl">도시</div>' +
        '<select id="city-sel" aria-label="도시 선택"></select>' +
        '<div class="geo-row" id="city-manual" hidden>' +
          '<input id="geo-q" name="cityname" type="text" placeholder="예: 오사카" aria-label="도시 이름" ' +
            'value="' + escHtml((trip && trip.place && trip.place.name) || '') + '">' +
          '<button id="geo-go" type="button">찾기</button>' +
        '</div>' +
        '<div class="geo-cur" id="geo-cur"></div>' +
        '<div class="geo-msg" id="geo-msg" hidden></div>' +
        '<ul class="geo-list" id="geo-list" hidden></ul>' +
      '</div>' +
      // 일차별 도시는 기존 여행에서만 — 새 여행은 아직 일차가 없다.
      (trip ? '<div class="daycity-block"><div class="geo-lbl">일차별 도시 ' +
        '<span class="geo-hint">(경유·이동하는 날만 지정하면 됩니다)</span></div>' +
        '<ul class="daycity-list" id="daycity-list"></ul></div>' : '') +
      '<div class="eerr" id="e-err" hidden></div>' +
      '<button type="submit">' + (trip ? '저장' : '만들기') + '</button>' +
    '</form>' +
    // 내보내기는 기존 여행에서만 — 새 여행은 아직 저장된 게 없다.
    (trip ? '<div class="eshare">' +
      '<div class="geo-lbl">내보내기</div>' +
      '<button id="e-export" type="button">📤 이 여행을 파일로 저장</button>' +
      '<p class="geo-msg">사진은 파일에 담기지 않습니다. 일정·경비·준비물만 저장됩니다.</p>' +
      '</div>' : '');

  document.getElementById("e-back").addEventListener("click", function () {
    go(trip ? '#/t/' + trip.id : '#/');
  });

  var exportBtn = document.getElementById("e-export");
  if (exportBtn) exportBtn.addEventListener('click', function () {
    // 사진(IndexedDB의 blob)은 담지 않는다 — base64로 인라인하면 파일이 수십 MB가
    // 되고, 받는 쪽에서 다시 IndexedDB에 넣어야 해 실패 지점이 늘어난다.
    // day.images의 id는 남지만 그 blob이 없으므로 렌더가 조용히 건너뛴다.
    var data = JSON.stringify(trip, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = exportFilename(trip);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  var countrySel = document.querySelector('#trip-form [name=country]');
  var curLine = document.getElementById("cur-line");

  // 고른 나라의 통화를 보여준다. 나라를 안 고르면 원화로 둔다 — 국내 여행도 있고,
  // 통화를 못 정한 채로도 여행을 만들 수 있어야 한다.
  function currentCurrency() {
    var c = countrySel && countrySel.value ? countryByCode(countrySel.value) : null;
    if (c && c.cur) return currencyByCode(c.cur);
    // 나라를 안 골랐다면 기존 통화를 유지한다(설정을 다시 열어 저장할 때 초기화되면 안 된다).
    if (trip && trip.currency && trip.currency.code) return currencyByCode(trip.currency.code);
    return defaultCurrency();
  }

  function paintCur() {
    if (!curLine) return;
    var c = currentCurrency();
    curLine.innerHTML = '통화 <b>' + escHtml(c.code) + '</b> ' +
      escHtml(c.symbol + ' · ' + c.name);
  }
  paintCur();

  var citySel = document.getElementById("city-sel");
  var cityManual = document.getElementById("city-manual");

  // 나라가 정해지면 그 나라 도시 목록을 채운다. 나라를 안 골랐거나 목록이 없는
  // 나라면 직접 입력만 남긴다.
  function paintCityOptions() {
    if (!citySel) return;
    var cc = countrySel ? countrySel.value : '';
    var list = citiesOf(cc);
    var cur = (pickedPlace !== undefined) ? pickedPlace : (trip ? trip.place : null);
    var curName = cur ? cur.name : '';
    var opts = ['<option value="">— 도시 선택 —</option>'];
    list.forEach(function (c, i) {
      var on = c.name === curName ? ' selected' : '';
      opts.push('<option value="' + i + '"' + on + '>' + escHtml(c.name) + '</option>');
    });
    // 목록에 없는 도시(직접 입력했거나 검색으로 고른 것)도 지금 값으로 보여 준다.
    var inList = list.some(function (c) { return c.name === curName; });
    if (curName && !inList) {
      opts.push('<option value="keep" selected>' + escHtml(curName) + '</option>');
    }
    opts.push('<option value="manual">직접 입력…</option>');
    citySel.innerHTML = opts.join('');
    // 목록이 없는 나라(또는 나라 미선택)에서는 직접 입력을 바로 연다.
    if (!list.length && cityManual) cityManual.hidden = false;
  }
  paintCityOptions();

  if (citySel) citySel.addEventListener('change', function () {
    var v = citySel.value;
    if (v === 'manual') {
      if (cityManual) cityManual.hidden = false;
      var qi = document.getElementById('geo-q');
      if (qi && qi.focus) qi.focus();
      return;
    }
    if (v === '' ) { pickedPlace = null; paintPickedCity(); return; }
    if (v === 'keep') return;
    var city = citiesOf(countrySel ? countrySel.value : '')[Number(v)];
    if (!city) return;
    pickedPlace = cityToPlace(city, countrySel.value);
    if (cityManual) cityManual.hidden = true;
    var qi2 = document.getElementById('geo-q');
    if (qi2) qi2.value = city.name;
    paintPickedCity();
    showMsg('저장을 눌러야 반영됩니다.');
  });

  if (countrySel) countrySel.addEventListener('change', function () {
    paintCur();
    // 나라가 바뀌면 이전 나라의 도시는 더 이상 맞지 않는다 — 목록을 새로 채운다.
    pickedPlace = null;
    var qi = document.getElementById('geo-q');
    if (qi) qi.value = '';
    paintCityOptions();
    paintPickedCity();
  });

  // undefined면 "도시를 건드리지 않음" — applyTripForm이 기존 값을 유지한다.
  var pickedPlace = undefined;
  // 일차별 오버라이드 {dayN: place|null}. 저장할 때만 반영된다.
  var pickedDayPlaces = {};
  // 검색 결과를 어디에 적용할지: null이면 여행 기본 도시, 숫자면 그 일차.
  var geoTarget = null;
  var curEl = document.getElementById("geo-cur");
  var msgEl = document.getElementById("geo-msg");
  var listEl = document.getElementById("geo-list");
  var qEl = document.getElementById("geo-q");
  var goEl = document.getElementById("geo-go");

  function paintPickedCity() {
    var p = (pickedPlace !== undefined) ? pickedPlace : (trip ? trip.place : null);
    curEl.innerHTML = p && p.lat !== undefined
      ? '📍 ' + escHtml(placeLabel(p)) + ' <span class="geo-hint">(날씨 연결됨)</span>'
      : '<span class="geo-none">좌표 없음 — 날씨는 표시되지 않습니다</span>';
  }
  paintPickedCity();

  function showMsg(text) {
    msgEl.textContent = text;
    msgEl.hidden = !text;
  }

  // 고른 도시의 나라를 나라 <select>에 반영한다(통화는 거기서 따라온다).
  // 반영했으면 나라 이름을, 아니면 null을 돌려준다.
  function applyCountryFromPlace(place) {
    if (!countrySel || !place || !place.cc) return null;
    var c = countryByCode(place.cc);
    if (!c || countrySel.value === c.cc) return null;
    countrySel.value = c.cc;
    paintCur();
    return c.name;
  }

  function runSearch() {
    var q = qEl.value.trim();
    if (!q) return;
    goEl.disabled = true;
    listEl.hidden = true;
    showMsg('검색 중…');
    geoSearch(q, function (all, err) {
      goEl.disabled = false;
      if (err) { showMsg(err); return; }
      // 나라를 골랐으면 그 나라 결과만 남긴다 — 안 그러면 베트남 여행에서 '사파'가
      // 북한 지명으로 잡히는 식으로 엉뚱한 곳이 섞인다.
      // 일차별 도시를 고르는 중(geoTarget !== null)에는 거르지 않는다: 경유지는
      // 여행 기본 나라와 다른 나라일 수 있다.
      var cc = (geoTarget === null && countrySel) ? countrySel.value : '';
      var list = cc ? all.filter(function (p) { return p.cc === cc; }) : all;
      if (!list.length && all.length && cc) {
        showMsg('선택한 나라에서 찾지 못했습니다. 나라를 바꾸거나 다른 이름으로 검색해 보세요.');
        return;
      }
      if (!list.length) {
        // 한국어 도시명은 대부분 그대로 찾힌다(다낭·호이안·타이베이 모두 O).
        // 그래도 안 나오면 철자나 더 큰 지명을 권한다.
        showMsg('결과가 없습니다. 철자를 확인하거나 가까운 큰 도시로 검색해 보세요.');
        return;
      }
      showMsg('');
      // 도시명·국가명은 외부 입력이다 — 반드시 escHtml을 거친다.
      listEl.innerHTML = list.map(function (p, i) {
        return '<li data-i="' + i + '">' + escHtml(placeLabel(p)) + '</li>';
      }).join('');
      listEl.hidden = false;
      listEl.querySelectorAll('li').forEach(function (li) {
        li.addEventListener('click', function () {
          var chosen = list[Number(li.dataset.i)];
          var forDay = geoTarget;
          if (geoTarget === null) pickedPlace = chosen;
          else pickedDayPlaces[geoTarget] = chosen;
          geoTarget = null;
          listEl.hidden = true;
          // 이 입력칸은 이제 검색창이 아니라 도시 이름 자체다 — 비우면 저장 시
          // 이름이 사라져 place가 null이 된다. 고른 이름으로 채운다.
          // (일차별 도시를 고르는 중이면 여행 기본 도시 칸은 건드리지 않는다.)
          if (forDay === null) qEl.value = chosen.name;
          paintPickedCity();
          if (forDay === null) paintCityOptions();
          paintDays();
          // 여행 기본 도시를 고르면 나라 선택도 그 나라로 맞춘다(통화가 따라온다).
          // 일차별 도시(forDay !== null)에서는 건드리지 않는다 — 그건 경유지일 뿐이고
          // 여행 기본 통화를 바꿀 이유가 없다.
          var picked = (forDay === null) ? applyCountryFromPlace(chosen) : null;
          showMsg(picked
            ? '나라를 ' + picked + '(으)로 맞췄습니다. 저장을 눌러야 반영됩니다.'
            : '저장을 눌러야 반영됩니다.');
        });
      });
    });
  }

  // 일차별 도시 목록. 지정된 일차는 그 도시를, 아니면 여행 기본값을 보여준다.
  function paintDays() {
    var host = document.getElementById("daycity-list");
    if (!host || !trip) return;
    var base = (pickedPlace !== undefined) ? pickedPlace : trip.place;
    host.innerHTML = trip.days.map(function (d) {
      var override = Object.prototype.hasOwnProperty.call(pickedDayPlaces, d.n)
        ? pickedDayPlaces[d.n] : d.place;
      var eff = override || base;
      var mark = override ? '📍 ' : '';
      var label = eff ? escHtml(placeLabel(eff)) : '<span class="geo-none">미지정</span>';
      return '<li><span class="dc-n">' + Number(d.n) + '일차</span>' +
        '<span class="dc-p">' + mark + label + '</span>' +
        '<button type="button" class="dc-set" data-n="' + Number(d.n) + '">변경</button>' +
        (override ? '<button type="button" class="dc-clr" data-n="' + Number(d.n) + '">기본값</button>' : '') +
        '</li>';
    }).join('');
    host.querySelectorAll('.dc-set').forEach(function (b) {
      b.addEventListener('click', function () {
        geoTarget = Number(b.dataset.n);
        showMsg(geoTarget + '일차에 적용할 도시를 검색하세요.');
        qEl.focus();
      });
    });
    host.querySelectorAll('.dc-clr').forEach(function (b) {
      b.addEventListener('click', function () {
        // null을 넣어야 "여행 기본값으로 되돌린다"가 저장 시 반영된다.
        pickedDayPlaces[Number(b.dataset.n)] = null;
        paintDays();
        showMsg('저장을 눌러야 반영됩니다.');
      });
    });
  }
  paintDays();

  goEl.addEventListener('click', runSearch);
  // 폼 안의 text input은 Enter로 상위 폼이 제출된다 — 가로채서 검색으로 돌린다.
  qEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    runSearch();
  });

  // go()는 location.hash만 바꾸고 hashchange는 비동기로 뜨므로, 제출 직후에도 폼이
  // 한 틱 동안 살아있다 — 그 사이 빠르게 두 번 누르면 applyTripForm(null, f)가 두 번
  // 실행되어 서로 다른 id로 여행이 두 개 저장된다. submitting 플래그로 막는다.
  var submitting = false;
  document.getElementById("trip-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;
    var fd = new FormData(e.target);
    var f = { title: fd.get('title'), start: fd.get('start'), end: fd.get('end'),
              party: fd.get('party'), hotel: fd.get('hotel') };
    // 도시는 직접 적은 이름을 쓰고, 좌표는 '찾기'로 고른 것이 있으면 얹는다 —
    // 검색이 0건이어도 이름은 남아야 한다(날씨만 안 뜬다).
    var cityName = String(fd.get('cityname') || '').trim();
    var base = (pickedPlace !== undefined) ? pickedPlace : (trip ? trip.place : null);
    if (cityName) {
      // 이름만 바꿨는데 예전 좌표가 남아 엉뚱한 날씨가 뜨는 것을 막는다.
      var sameCity = base && base.name === cityName;
      f.place = sameCity ? base : (pickedPlace || { name: cityName });
      if (f.place && f.place.name !== cityName) f.place = { name: cityName };
    } else {
      f.place = null;
    }
    // 통화는 고른 나라에서 끌어온다(폼에 통화 입력란이 따로 없다).
    f.currency = currentCurrency();
    f.countryCode = countrySel && countrySel.value ? countrySel.value : null;
    for (var _k in pickedDayPlaces) {
      if (Object.prototype.hasOwnProperty.call(pickedDayPlaces, _k)) { f.dayPlaces = pickedDayPlaces; break; }
    }
    var box = document.getElementById("e-err");
    submitting = true;
    var res = submitTripForm(trip, f);
    if (!res.ok) {
      submitting = false;
      box.textContent = res.message;
      box.hidden = false;
      return;
    }
    box.hidden = true;
    go('#/t/' + res.trip.id);
  });
}

// ---- 일정 카드 편집 (Task 8) ----
// applyTripForm과 달리 여기 있는 addItem/updateItem/removeItem은 순수 함수가 아니다 —
// 인자로 받은 trip(과 그 trip.days 안의 day 객체)을 그 자리에서 고쳐 같은 참조를
// 돌려준다. 호출부(views.js)가 이 mutation을 전제로 저장 여부를 직접 챙긴다.

// 안정 정렬 — 같은 시간이면 원래 순서를 유지한다.
// time이 없거나 문자열이 아닌 항목(가져온 데이터가 손상됐거나 손으로 편집된 경우 등)은
// 정렬 키가 없는 셈이므로 목록 맨 뒤로 보낸다 — "시간 미정" 항목이 화면 아래쪽에 몰리는
// 게 자연스럽고, 무엇보다 a<b와 b<a가 둘 다 false가 되어 비교자가 모순(양방향 모두 1을
// 반환)에 빠지는 걸 피할 수 있다. 그 모순 때문에 정상 시간을 가진 항목들끼리도 상대
// 순서가 깨지는 게 원래 버그였다 — malformed 항목이 하나만 섞여도 Array.sort 구현에 따라
// 결과가 정의되지 않는다.
function sortItems(items) {
  function timeKey(it) {
    return typeof it.time === 'string' ? it.time : null;
  }
  return items.map(function (it, i) { return { it: it, i: i }; })
    .sort(function (a, b) {
      var ta = timeKey(a.it), tb = timeKey(b.it);
      if (ta === tb) return a.i - b.i;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta < tb ? -1 : 1;
    })
    .map(function (w) { return w.it; });
}

// prompt()로 받은 시간 문자열을 "HH:MM"(24시간, 0-padded)으로 정규화한다. <input type=time>은
// 브라우저가 이미 이 형식을 강제하지만, prompt 경로는 아무 검증도 거치지 않으므로 여기서
// 막아야 한다. '9:00'처럼 시가 한 자리인 흔한 실수는 정규화해서 받아준다(sortItems가 문자열
// 사전순으로 비교하므로 '9:00'을 그대로 저장하면 '14:00'보다 뒤로 밀려버린다) — 그 밖의
// 잘못된 입력('9시', '', 'abc')은 null을 돌려줘 호출부가 거부하게 한다.
function normalizeTimeInput(s) {
  var m = /^([0-9]{1,2}):([0-9]{2})$/.exec(String(s).trim());
  if (!m) return null;
  var h = Number(m[1]), mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return (h < 10 ? '0' : '') + h + ':' + m[2];
}

// 일정 입력(추가 폼·prompt 편집)이 공유하는 메시지. 두 경로가 같은 실수에 서로 다른
// 말을 하지 않도록 한 곳에 둔다.
var MSG_BAD_TIME = '시간 형식이 올바르지 않습니다. 예: 09:00';
var MSG_EMPTY_TEXT = '일정 내용을 입력해 주세요.';

// 추가 폼(item-add)의 입력을 저장 가능한 형태로 검증·정규화한다. <input type="time">이
// 지원되지 않는 환경에서는 이 입력이 그냥 text로 떨어져 '9:00' 같은 값이 그대로 들어오는데,
// sortItems가 문자열 사전순으로 비교하므로 그대로 저장하면 '14:00'보다 뒤로 밀린다 —
// prompt 편집 경로가 이미 거치는 검증(normalizeTimeInput + 빈 내용 거부)을 추가 폼도
// 똑같이 거치게 한다. ok:false면 message를 그대로 사용자에게 보여주면 된다.
function parseItemInput(rawTime, rawText) {
  var time = normalizeTimeInput(rawTime);
  if (!time) return { ok: false, message: MSG_BAD_TIME };
  var text = String(rawText == null ? '' : rawText).trim();
  if (!text) return { ok: false, message: MSG_EMPTY_TEXT };
  return { ok: true, time: time, text: text };
}

function findDay(trip, dayN) {
  return trip.days.filter(function (d) { return d.n === dayN; })[0] || null;
}

function addItem(trip, dayN, o) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.items.push({ id: newItemId(), time: o.time, text: o.text });
  day.items = sortItems(day.items);
  return trip;
}

function updateItem(trip, dayN, itemId, o) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.items.forEach(function (it) {
    if (it.id !== itemId) return;
    it.time = o.time;
    it.text = o.text;
  });
  day.items = sortItems(day.items);
  return trip;
}

function removeItem(trip, dayN, itemId) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.items = day.items.filter(function (it) { return it.id !== itemId; });
  return trip;
}

// 그 일차만 다른 도시일 때 지정한다. place가 null이면 여행 기본값 상속으로 되돌린다.
// addItem/updateItem/removeItem과 같은 계약 — 인자로 받은 trip을 그 자리에서 고친다.
function setDayPlace(trip, dayN, place) {
  var day = findDay(trip, dayN);
  if (!day) return trip;
  day.place = place || null;
  return trip;
}

// ---- 섹션 편집 (2단계-C) ----
// 데이터는 text/list/table 세 형식을 지원하지만 편집기는 글·목록만 다룬다.
// 표는 좁은 화면에서 행·열을 편집하는 UI가 번거로운 데 비해 쓰임이 적다 —
// 오사카 샘플의 라피트 시간표처럼 이미 있는 표는 읽기 전용으로 그대로 보존된다.
function sectionEditable(sec) {
  return !!sec && (sec.type === "text" || sec.type === "list");
}

// 편집기의 textarea 한 칸으로 두 형식을 다룬다: 목록은 줄 단위로 쪼갠다.
function sectionBodyFromText(type, text) {
  var t = String(text == null ? "" : text);
  if (type !== "list") return t;
  return t.split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });
}

function sectionBodyToText(sec) {
  if (!sec) return "";
  if (sec.type === "list") return (sec.body || []).join('\n');
  if (sec.type === "text") return String(sec.body == null ? "" : sec.body);
  return "";
}

function validateSectionForm(f) {
  if (!f || !f.title || !f.title.trim()) return '섹션 제목을 입력하세요.';
  if (!f.body || !f.body.trim()) return '내용을 입력하세요.';
  return null;
}

// addItem/updateItem과 같은 계약 — 인자로 받은 trip을 그 자리에서 고친다.
function addSection(trip, f) {
  if (!trip) return trip;
  if (!Array.isArray(trip.sections)) trip.sections = [];
  trip.sections.push({
    id: newSectionId(),
    icon: (f.icon || '📌').trim() || '📌',
    title: f.title.trim(),
    type: f.type === 'text' ? 'text' : 'list',
    body: sectionBodyFromText(f.type, f.body)
  });
  return trip;
}

function updateSection(trip, id, f) {
  if (!trip || !Array.isArray(trip.sections)) return trip;
  trip.sections.forEach(function (s) {
    if (s.id !== id) return;
    s.icon = (f.icon || '📌').trim() || '📌';
    s.title = f.title.trim();
    s.type = f.type === 'text' ? 'text' : 'list';
    // 형식이 바뀌면 본문 표현도 함께 바꾼다(목록 ↔ 여러 줄 글).
    s.body = sectionBodyFromText(f.type, f.body);
  });
  return trip;
}

function removeSection(trip, id) {
  if (!trip || !Array.isArray(trip.sections)) return trip;
  trip.sections = trip.sections.filter(function (s) { return s.id !== id; });
  return trip;
}

// dir는 -1(위) 또는 1(아래). 끝에서 더 밀면 아무 일도 하지 않는다.
function moveSection(trip, id, dir) {
  if (!trip || !Array.isArray(trip.sections)) return trip;
  var i = -1;
  trip.sections.forEach(function (s, n) { if (s.id === id) i = n; });
  if (i < 0) return trip;
  var j = i + dir;
  if (j < 0 || j >= trip.sections.length) return trip;
  var tmp = trip.sections[i];
  trip.sections[i] = trip.sections[j];
  trip.sections[j] = tmp;
  return trip;
}

// ---- 일차 메모 ----
// 예전에는 day.meals(엑셀에서 온 "뭐먹지" 문구)와, 그 답을 따로 저장한
// meal:<date>:<i> 키가 짝을 이뤘다. 자유 메모로 바꾸면서 둘을 notes 하나로 합쳤다.
// addItem 계열과 같은 계약 — 인자로 받은 day를 그 자리에서 고친다.
function addNote(day, text) {
  if (!day) return day;
  if (!Array.isArray(day.notes)) day.notes = [];
  var t = String(text == null ? '' : text).trim();
  if (!t) return day;
  day.notes.push({ id: newNoteId(), text: t });
  return day;
}

function updateNote(day, id, text) {
  if (!day || !Array.isArray(day.notes)) return day;
  var t = String(text == null ? '' : text).trim();
  if (!t) return day;
  day.notes.forEach(function (n) { if (n.id === id) n.text = t; });
  return day;
}

function removeNote(day, id) {
  if (!day || !Array.isArray(day.notes)) return day;
  day.notes = day.notes.filter(function (n) { return n.id !== id; });
  return day;
}

// ---- 출발 전 결제 내역 편집 ----
// 항공·숙소처럼 떠나기 전에 결제한 것들. 현지 경비(spend)와 달리 원화로만 적는다.
function validateExpenseForm(f) {
  if (!f || !f.cat || !String(f.cat).trim()) return '항목을 입력하세요.';
  var n = Number(f.krw);
  if (!isFinite(n) || n <= 0) return '금액을 입력하세요.';
  return null;
}

function expenseFromForm(f) {
  return {
    date: String(f.date || '').trim(),
    cat: String(f.cat).trim(),
    detail: String(f.detail || '').trim(),
    pay: String(f.pay || '').trim(),
    krw: Math.round(Number(f.krw)),
    note: String(f.note || '').trim()
  };
}

function addExpense(trip, f) {
  if (!trip) return trip;
  if (!Array.isArray(trip.expenses)) trip.expenses = [];
  var e = expenseFromForm(f);
  e.id = newExpenseId();
  trip.expenses.push(e);
  return trip;
}

function updateExpense(trip, id, f) {
  if (!trip || !Array.isArray(trip.expenses)) return trip;
  trip.expenses.forEach(function (e, i) {
    if (e.id !== id) return;
    var next = expenseFromForm(f);
    next.id = id;
    trip.expenses[i] = next;
  });
  return trip;
}

function removeExpense(trip, id) {
  if (!trip || !Array.isArray(trip.expenses)) return trip;
  trip.expenses = trip.expenses.filter(function (e) { return e.id !== id; });
  return trip;
}
