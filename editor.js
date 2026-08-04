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

// trip이 null이면 새로 만들고, 있으면 필드를 갱신한다. days는 항상 재동기화한다.
// 참고(편집 경로): trip을 새로 만들지 않고 그 자리에서 고쳐 그대로 돌려준다 — 즉
// 반환값은 인자로 받은 trip과 동일한 객체다. saveTrip이 실패해도 이미 메모리 위의
// trip은 새 값으로 바뀌어 있다는 뜻이라, 실패 시 화면을 그대로 두면 저장 안 된 값이
// 저장된 것처럼 보일 수 있다 — 그래서 submitTripForm은 실패 시에도 절대 navigate하지
// 않고 에러를 보여준다(아래 참고).
function applyTripForm(trip, f) {
  if (!trip) {
    return emptyTrip({ title: f.title.trim(), start: f.start, end: f.end,
                       party: Number(f.party), hotel: (f.hotel || '').trim() });
  }
  trip.title = f.title.trim();
  trip.start = f.start;
  trip.end = f.end;
  trip.party = Number(f.party);
  trip.hotel = (f.hotel || '').trim();
  trip.days = resyncDays(trip.days, f.start, f.end);
  return trip;
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
