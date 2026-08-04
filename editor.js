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
    return emptyTrip({ title: f.title.trim(), start: f.start, end: f.end,
                       party: Number(f.party), hotel: (f.hotel || '').trim() });
  }
  var next = {};
  for (var k in trip) { if (Object.prototype.hasOwnProperty.call(trip, k)) next[k] = trip[k]; }
  next.title = f.title.trim();
  next.start = f.start;
  next.end = f.end;
  next.party = Number(f.party);
  next.hotel = (f.hotel || '').trim();
  next.days = resyncDays(trip.days, f.start, f.end);
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
      '<div class="eerr" id="e-err" hidden></div>' +
      '<button type="submit">' + (trip ? '저장' : '만들기') + '</button>' +
    '</form>';

  document.getElementById("e-back").addEventListener("click", function () {
    go(trip ? '#/t/' + trip.id : '#/');
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
