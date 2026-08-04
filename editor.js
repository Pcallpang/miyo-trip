// 여행 만들기·설정, 일정 편집 (Task 7-8)

var MAX_TRIP_DAYS = 90;

function validateTripForm(f) {
  if (!f.title || !f.title.trim()) return '여행 제목을 입력하세요.';
  if (!f.start || !f.end) return '시작일과 종료일을 입력하세요.';
  if (f.end < f.start) return '종료일이 시작일보다 빠릅니다.';
  if (daysBetween(f.start, f.end) > MAX_TRIP_DAYS) return '여행 기간은 최대 90일입니다.';
  if (!(Number(f.party) >= 1)) return '인원은 1명 이상이어야 합니다.';
  return null;
}

// trip이 null이면 새로 만들고, 있으면 필드를 갱신한다. days는 항상 재동기화한다.
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
        'value="' + (trip ? trip.party : 2) + '"></label>' +
      '<label>숙소<textarea name="hotel" rows="2" ' +
        'placeholder="숙소명 · 체크인/아웃">' + escHtml(trip ? trip.hotel : '') + '</textarea></label>' +
      '<div class="eerr" id="e-err" hidden></div>' +
      '<button type="submit">' + (trip ? '저장' : '만들기') + '</button>' +
    '</form>';

  document.getElementById("e-back").addEventListener("click", function () {
    go(trip ? '#/t/' + trip.id : '#/');
  });

  document.getElementById("trip-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var f = { title: fd.get('title'), start: fd.get('start'), end: fd.get('end'),
              party: fd.get('party'), hotel: fd.get('hotel') };
    var err = validateTripForm(f);
    var box = document.getElementById("e-err");
    if (err) { box.textContent = err; box.hidden = false; return; }
    box.hidden = true;
    var saved = applyTripForm(trip, f);
    saveTrip(saved);
    go('#/t/' + saved.id);
  });
}
