// 렌더 계층: DOM에 그리는 함수만 모은다.
// trip(여행 본체)과 st(tripStore)를 인자로 받는다 — 전역 여행/저장소를 읽지 않는다.
// schema.js·remote.js 다음, app.js 앞에 로드된다 (dowOf/daysBetween은 schema.js,
// wxGet/wxLine/wxStamp는 remote.js, dayPlace는 schema.js).

// 사용자가 입력한 문자열이 HTML로 해석되지 않게 막는다.
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// escape를 먼저 하고, 배지 판정은 원본 텍스트로 한다.
function itemLinesHtml(text) {
  return String(text).split('\n').map(function (l) {
    var e = escHtml(l);
    if (/\(패스권-시간\)|\(시간\)/.test(l)) {
      return '<div class="line timed"><span class="tag">⏰ 시간지정</span>' + e + '</div>';
    }
    if (/예약 완료/.test(l)) {
      return '<div class="line booked"><span class="tag">✅ 예약완료</span>' + e + '</div>';
    }
    return '<div class="line">' + e + '</div>';
  }).join('');
}

// 편집 토글은 두지 않는다. 이 앱은 내 여행을 내가 고치는 것뿐이라 "보는 사람"과
// "고치는 사람"이 갈리지 않고, 입력이 모달로 옮겨간 뒤로는 폼이 화면을 어지럽히지도
// 않는다. 항목을 탭하면 편집 모달이 열리고(삭제도 그 안에서), 추가 버튼은 늘 보인다.

// text가 문자열이 아닌 손상된 항목(검증 없이 가져온 JSON 등)에서도 던지지 않는다 —
// normalizeDay가 렌더 전에 보정하지만, 이 판정 자체도 같은 계약을 지킨다.
function isUndecided(text) {
  var t = String(text == null ? "" : text).trim();
  return /뭐먹지|\?$/.test(t) || t === "";
}

function dday(todayISO, startISO, endISO) {
  const day = 86400000;
  const t = Date.parse(todayISO + "T00:00:00");
  const s = Date.parse(startISO + "T00:00:00");
  const e = Date.parse(endISO + "T00:00:00");
  if (t < s) return "D-" + Math.round((s - t) / day);
  if (t > e) return "여행 종료";
  return "여행 중 " + (Math.round((t - s) / day) + 1) + "일차";
}

// ---- 현지 경비 ----

function spendList(st) {
  var v = st.get("spend", []);
  return Array.isArray(v) ? v : [];
}

// 일차 번호(n)가 아니라 날짜로 키를 잡는다 — resyncDays가 날짜를 기준으로 일차를
// 보존하면서 n을 1부터 다시 매기기 때문에, n으로 키를 잡으면 시작일을 하루만 앞당겨도
// 메모가 통째로 밀려 엉뚱한 날에 붙거나 화면에서 사라진다(store.js의 migrateMealKeys 참고).
// 날짜는 문자열이므로 속성 컨텍스트에 넣을 때 반드시 escHtml을 거쳐야 한다.
function mealKey(date, i) { return "meal:" + String(date) + ":" + i; }

// ---- 상단 요약 ----

// lead가 true면(다른 요약 텍스트 뒤가 아니라 줄의 맨 앞이면) "· " 구분자를 붙이지 않는다.
// 통화가 여럿이면 요약 한 줄에 다 담을 수 없으므로 원화 환산 총합만 보여준다 —
// 통화별 내역은 경비 탭에서 본다.
function summarySpend(st, lead) {
  var totals = spendTotals(spendList(st));
  if (!totals.length) return '';
  var rates = fxRates(st);
  var body;
  if (totals.length === 1) {
    var one = totals[0];
    var krw = toKRW(one.amount, one.cur, rates);
    // 통화 기호는 외부 입력이 될 수 있다(가져온 JSON의 currency.symbol) — escHtml 필수.
    body = '💸 현지 ' + escHtml(fmtAmount(one.amount, currencyByCode(one.cur))) +
      (krw === null ? '' : ' (약 ' + escHtml(fmtKRW(krw)) + ')');
  } else {
    // 환산할 수 없는 통화가 하나라도 있으면 총합이 거짓이 되므로 "+" 표시를 붙인다.
    var sum = 0, partial = false;
    totals.forEach(function (t) {
      var k = toKRW(t.amount, t.cur, rates);
      if (k === null) partial = true; else sum += k;
    });
    body = '💸 현지 ' + totals.length + '개 통화' +
      (sum ? ' (약 ' + escHtml(fmtKRW(sum)) + (partial ? '+' : '') + ')' : '');
  }
  // lead면 줄의 맨 앞이므로 선행 공백도 붙이지 않는다 — 붙이면 .cost가 공백으로 시작한다.
  var dot = lead ? '' : '· ';
  var gap = lead ? '' : ' ';
  return gap + '<span class="spent">' + dot + body + '</span>';
}

function renderSummary(trip, st) {
  const today = todayLocal();
  const el = document.getElementById("summary");
  const nights = daysBetween(trip.start, trip.end) - 1;
  el.innerHTML =
    '<button class="back-list" type="button" aria-label="여행 목록">←</button>' +
    '<button class="edit-trip" type="button" aria-label="여행 설정">⚙</button>' +
    '<div class="dday">' + dday(today, trip.start, trip.end) + '</div>' +
    '<h1>' + escHtml(trip.title) + '</h1>' +
    '<div class="period">' + escHtml(trip.start) + ' ~ ' + escHtml(trip.end) +
      ' · ' + nights + '박 ' + (nights + 1) + '일</div>' +
    (function () {
      // 여행 기본 도시의 오늘 날씨. 도시를 지정하지 않은 여행이면 캐시가 비어
      // 줄 자체가 사라진다(예보 없는 날짜와 같은 처리 — 오류 문구를 넣지 않는다).
      var place = trip.place;
      var line = wxLine(wxGet(st, place).map, todayLocal());
      return line ? '<div class="wx">' + line.replace(" ", " 오늘 ") + wxStamp(place) + '</div>' : '';
    })() +
    (function () {
      // 사전 예산(budgetKRW)과 현지 경비 합계(summarySpend)는 서로 독립된 정보다.
      // 예산을 입력하지 않은 여행(생성/설정 화면에 그 입력란이 없어 기본값 0으로
      // 남는 게 보통이다)이라도 경비를 기록했다면 그 합계는 보여야 한다.
      var budgetLine = trip.budgetKRW
        ? '💰 총 ' + Number(trip.budgetKRW).toLocaleString('ko-KR') + '원 (' +
          Number(trip.party) + '인)'
        : '';
      var spendLine = summarySpend(st, !budgetLine);
      if (!budgetLine && !spendLine) return '';
      return '<div class="cost">' + budgetLine + spendLine + '</div>';
    })();
  var bl = el.querySelector('.back-list');
  if (bl) bl.addEventListener('click', function () { go('#/'); });
  var eb = el.querySelector('.edit-trip');
  if (eb) eb.addEventListener('click', function () { go('#/t/' + trip.id + '/edit'); });
}

// ---- 일차 탭 / 타임라인 ----

function renderTabs(trip, selectedN, onSelect) {
  const nav = document.getElementById("daytabs");
  nav.innerHTML = trip.days.map(function (d) {
    const on = d.n === selectedN ? ' data-selected="1"' : '';
    return '<button class="tab"' + on + ' data-n="' + Number(d.n) + '">' +
      '<span class="tn">' + Number(d.n) + '일차</span>' +
      '<span class="td">' + escHtml(d.date.slice(5)) + '(' + dowOf(d.date) + ')</span></button>';
  }).join('');
  nav.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { onSelect(parseInt(b.dataset.n, 10)); });
  });
  // 탭이 많은 여행(30일)에서 현재 일차가 화면 밖에 있는 것을 막는다.
  const sel = nav.querySelector('.tab[data-selected]');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ inline: "center", block: "nearest" });
}

// saveTripBody가 실패했을 때 trip.days를 저장소 값으로 되돌릴지 판단하는 순수 로직.
// DOM에도 alert에도 손대지 않으므로 테스트에서 바로 호출할 수 있다(afterItemEdit을
// 통째로 테스트하려면 alert 스텁이 필요한데, 그 스텁 없이도 이 판단 로직 자체는
// 검증할 수 있게 분리했다). ok가 true면 아무 것도 하지 않는다.
// 저장소에서 이 여행 자체를 못 찾으면(예: 다른 탭에서 삭제됨) 되돌릴 원본이 없다는
// 뜻이라 lost:true를 돌려준다 — 이 경우 메모리 위 trip.days는 여전히 실패한 시도로
// 오염된 phantom 상태이므로, 호출부는 그 화면을 그대로 다시 그리지 말고 안전한 곳으로
// 옮겨야 한다.
function reconcileAfterSaveFail(trip, ok) {
  if (ok) return { reverted: false, lost: false };
  var fresh = loadTrip(trip.id);
  if (fresh) { trip.days = fresh.days; return { reverted: true, lost: false }; }
  return { reverted: false, lost: true };
}

// 일정·메모 추가·수정·삭제 후 공통으로 거치는 경로.
// saveTripBody의 성공 여부를 반드시 확인한다 — 확인 없이 넘기면 저장이 조용히 실패해도
// 화면은 성공한 것처럼 보인다. 실패하면 사용자에게 알리고, 이미 메모리 위에서 고쳐놓은
// trip.days를 저장소의 실제 값으로 되돌려 다음 조작이 이번에 실패한 시도 위에 쌓이지
// 않게 한다(reconcileAfterSaveFail). 다시 그리는 범위는 타임라인뿐이다(요구사항: 일차
// 전환/편집 토글과 마찬가지로 #fixed는 건드리지 않는다) — repaintDay가 day.items가
// 배열이 아닌 경우의 보정도 함께 해 준다(showDay가 여는 경로에서 하는 것과 동일).
function afterItemEdit(trip, day, st, ok) {
  var res = reconcileAfterSaveFail(trip, ok);
  if (res.lost) {
    alert('일정 저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
    go('#/');
    return;
  }
  if (res.reverted) alert('일정 저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
  repaintDay(trip, day.n, st);
}


function renderTimeline(trip, day, st) {
  const main = document.getElementById("timeline");
  // 줄 자체가 편집 버튼이다 — 수정·삭제 버튼을 매 줄에 붙이면 읽을 때 복잡하고,
  // 폰에서 잘못 누르기도 쉽다. 삭제는 편집 모달 안에 둔다.
  const slots = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    return '<button class="slot' + cls + '" type="button" data-item="' + escHtml(it.id) + '">' +
      '<div class="time">' + escHtml(it.time) + '</div>' +
      '<div class="what">' + itemLinesHtml(it.text) + '</div></button>';
  }).join('');
  // 새로 만든 여행의 1일차는 일정이 하나도 없다 — 무엇을 하면 되는지 알려 준다.
  const rows = slots || '<p class="empty">아직 일정이 없습니다. 위 + 일정을 눌러 추가해 보세요.</p>';
  // 자유 메모. 예전의 "뭐먹지"(엑셀에서 온 문구 + 답 입력칸)를 대체한다 —
  // 그 틀에 맞지 않는 메모(예약 번호, 챙길 것)를 적을 곳이 없었다.
  const noteList = Array.isArray(day.notes) ? day.notes : [];
  // 메모는 카드 밑에 늘어놓지 않고 모달 안에서 본다 — 일정 흐름을 읽는 데 방해가
  // 되지 않으면서, 열면 목록·추가·수정·삭제가 한자리에 있다. 버튼에 개수만 알린다.
  const noteCount = noteList.length;
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + Number(day.n) + '일차</span> ' +
      '<span class="ddate">' + escHtml(day.date) + '(' + dowOf(day.date) + ')</span>' +
      // 그날 어디서 자고 어느 도시에 있는지가 그 일차에서 가장 먼저 알고 싶은 것이다.
      // 여행 설정에서 정한 도시(일차 오버라이드가 있으면 그것)와 숙소를 여기 붙인다 —
      // 요약 헤더의 숙소 줄은 이것과 겹쳐 없앴다.
      (function () {
        var dp = dayPlace(trip, day);
        var city = dp && dp.name
          ? '<div class="dcity">📍 ' + escHtml(dp.name) + '</div>' : '';
        var h = dayHotel(trip, day);
        // 숙소는 여러 줄 textarea다 — 줄바꿈을 가운뎃점으로 이어 한 줄에 눌러 담는다.
        var hotel = h ? '<div class="dhotel">🏨 ' + escHtml(h).replace(/\n/g, ' · ') + '</div>' : '';
        var line = wxLine(wxGet(st, dp).map, day.date);
        var wx = line ? '<div class="dwx">' + line + wxStamp(dp) + '</div>' : '';
        return city + hotel + wx;
      })() +
      // 입력은 모달에서 받는다 — 폼을 카드에 붙이면 스크롤이 길어져 불편하다.
      // 일정 추가는 아이콘 하나로 충분하다(무엇에 대한 +인지는 자리가 말해 준다).
      '<div class="day-actions">' +
        '<button class="day-add-item" type="button" aria-label="일정 추가">+</button>' +
        '<button class="day-note" type="button">📝 메모' +
          (noteCount ? ' <span class="nbadge">' + noteCount + '</span>' : '') +
        '</button>' +
      '</div></div>' +
      '<div class="slots">' + rows + '</div></div>';

  var noteBtn = main.querySelector('.day-note');
  if (noteBtn) noteBtn.addEventListener('click', function () {
    openNotesModal(trip, day, st);
  });

  main.querySelectorAll('.memo').forEach(function (inp) {
    inp.addEventListener('input', function () { st.set(inp.dataset.key, inp.value); });
  });
  main.querySelectorAll('.slot').forEach(function (b) {
    b.addEventListener('click', function () {
      var it = day.items.filter(function (x) { return x.id === b.dataset.item; })[0];
      if (it) openItemModal(trip, day, st, it);
    });
  });
  var addItemBtn = main.querySelector('.day-add-item');
  if (addItemBtn) addItemBtn.addEventListener('click', function () {
    openItemModal(trip, day, st, null);
  });
}

// 일정 추가·수정. 두 경우가 같은 폼을 쓰므로 검증도 한 곳(parseItemInput)만 거친다.
function openItemModal(trip, day, st, it) {
  modalOpen({
    title: (it ? '일정 수정' : '일정 추가') + ' · ' + Number(day.n) + '일차',
    submitLabel: it ? '저장' : '추가',
    // 삭제는 모달 안에 둔다 — 목록에 삭제 버튼을 늘어놓으면 읽을 때 복잡하고
    // 폰에서 잘못 누르기 쉽다.
    onDelete: it ? function () {
      removeItem(trip, day.n, it.id);
      afterItemEdit(trip, day, st, saveTripBody(trip));
    } : null,
    deleteConfirm: '이 일정을 삭제할까요?',
    html:
      '<label>시간<input class="m-time" type="time" step="300" required ' +
        'value="' + escHtml(it ? it.time : '') + '"></label>' +
      '<label>내용<textarea class="m-text" rows="4" required ' +
        'placeholder="예: 이치란 라멘 신사이바시점">' + escHtml(it ? it.text : '') + '</textarea></label>',
    onSubmit: function (form) {
      var p = parseItemInput(form.querySelector('.m-time').value,
                            form.querySelector('.m-text').value);
      if (!p.ok) return p.message;
      if (it) updateItem(trip, day.n, it.id, { time: p.time, text: p.text });
      else addItem(trip, day.n, { time: p.time, text: p.text });
      afterItemEdit(trip, day, st, saveTripBody(trip));
      return null;
    }
  });
}

// 메모 목록 모달. 여기서 항목을 누르면 편집 모달로 넘어가고, 저장·삭제 뒤에는
// 다시 이 목록으로 돌아온다 — 메모를 여러 개 손볼 때 매번 카드에서 다시 여는
// 왕복을 없앤다.
function openNotesModal(trip, day, st) {
  var list = Array.isArray(day.notes) ? day.notes : [];
  var body = list.length
    ? '<div class="mnotes">' + list.map(function (n) {
        return '<button class="mnote" type="button" data-id="' + escHtml(n.id) + '">' +
          itemLinesHtml(n.text) + '</button>';
      }).join('') + '</div>'
    : '<p class="mnote-empty">아직 메모가 없습니다.</p>';
  var form = modalOpen({
    title: '메모 · ' + Number(day.n) + '일차',
    closeLabel: '닫기',
    html: body + '<button class="mnote-add" type="button">+ 메모 추가</button>'
  });
  form.querySelector('.mnote-add').addEventListener('click', function () {
    openNoteModal(trip, day, st, null);
  });
  form.querySelectorAll('.mnote').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = list.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (n) openNoteModal(trip, day, st, n);
    });
  });
}

function openNoteModal(trip, day, st, note) {
  modalOpen({
    title: (note ? '메모 수정' : '메모 추가') + ' · ' + Number(day.n) + '일차',
    submitLabel: note ? '저장' : '추가',
    onDelete: note ? function () {
      removeNote(day, note.id);
      afterItemEdit(trip, day, st, saveTripBody(trip));
    } : null,
    deleteConfirm: '이 메모를 삭제할까요?',
    // 저장·삭제가 끝나면 목록으로 돌아간다 — 메모를 이어서 손보기 쉽게.
    onDone: function () { openNotesModal(trip, day, st); },
    html:
      '<label>메모<textarea class="m-note" rows="5" required ' +
        'placeholder="예: 스시야 19시 예약 · 010-1234-5678">' +
        escHtml(note ? note.text : '') + '</textarea></label>',
    onSubmit: function (form) {
      var text = form.querySelector('.m-note').value.trim();
      if (!text) return MSG_EMPTY_TEXT;
      if (note) updateNote(day, note.id, text);
      else addNote(day, text);
      afterItemEdit(trip, day, st, saveTripBody(trip));
      return null;
    }
  });
}

// ---- 하단 고정 섹션 ----

function sectionBodyHtml(trip, sec) {
  if (sec.type === "text") return itemLinesHtml(sec.body);
  if (sec.type === "list") {
    return '<ul>' + sec.body.map(function (t) {
      return '<li>' + escHtml(t) + '</li>';
    }).join('') + '</ul>';
  }
  if (sec.type === "table") {
    return sec.body.map(function (tb) {
      return '<div class="tblwrap"><table>' +
        (tb.caption ? '<caption>' + escHtml(tb.caption) + '</caption>' : '') +
        '<thead><tr>' + tb.head.map(function (h) {
          return '<th>' + escHtml(h) + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        tb.rows.map(function (r) {
          return '<tr>' + r.map(function (c) {
            return '<td>' + escHtml(c) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
  }
  return '';
}

// 합계는 trip.expenses에서 직접 계산한다 — 사용자가 항목을 추가해도 어긋나지 않게.
function expensesTableHtml(trip) {
  // 줄을 탭하면 수정 모달이 열린다(일정·메모와 같은 방식). 표 안에 버튼 열을
  // 따로 두면 폭이 좁은 폰에서 금액이 밀린다.
  const rows = trip.expenses.map(function (e) {
    return '<tr class="exp-r" tabindex="0" role="button" data-id="' + escHtml(e.id) + '">' +
      '<td>' + escHtml(e.cat) + '</td><td>' + escHtml(e.detail) + '</td>' +
      '<td class="num">' + Number(e.krw).toLocaleString('ko-KR') + '</td></tr>';
  }).join('');
  const total = trip.expenses.reduce(function (s, e) { return s + Number(e.krw || 0); }, 0);
  return '<div class="tblwrap"><table>' +
    '<thead><tr><th>항목</th><th>상세</th><th class="num">금액(원)</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td colspan="2">합계</td><td class="num">' +
      total.toLocaleString('ko-KR') + '</td></tr></tfoot></table></div>';
}

function expenseEditorHtml(trip) {
  return '<div class="exp-actions">' +
    '<button class="exp-new" type="button">+ 내역 추가</button></div>';
}

// ---- 모달 ----
// 폼을 화면 아래에 길게 붙이면 스크롤이 늘어나 쓰기 불편하다. 일정·메모·결제내역
// 입력은 모두 이 모달 하나를 쓴다(prompt()로 하던 것도 여기로 옮겼다 — prompt는
// 여러 줄을 못 받고 형식 검증도 못 한다).
var _modalEl = null;
var _modalPrevFocus = null;

function modalClose() {
  if (!_modalEl) return;
  _modalEl.remove();
  _modalEl = null;
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', _modalKey);
  if (_modalPrevFocus && _modalPrevFocus.focus) {
    try { _modalPrevFocus.focus(); } catch (e) {}
  }
  _modalPrevFocus = null;
}

function _modalKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); modalClose(); }
}

// opts: { title, html, submitLabel, onSubmit(form) -> 오류 문자열 또는 null }
// onSubmit이 문자열을 돌려주면 모달을 닫지 않고 그 오류를 보여준다.
// closeLabel을 주면 입력 폼이 아니라 목록형 모달이 된다 — 저장 버튼 없이 닫기만
// 둔다(메모 목록처럼 내용이 그 자리에서 바뀌지 않는 화면).
function modalOpen(opts) {
  modalClose();
  _modalPrevFocus = document.activeElement;
  var el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML =
    '<div class="modal-back"></div>' +
    '<div class="modal-card" role="dialog" aria-modal="true" aria-label="' +
      escHtml(opts.title) + '">' +
      '<div class="modal-head">' +
        '<h2>' + escHtml(opts.title) + '</h2>' +
        '<button class="modal-x" type="button" aria-label="닫기">×</button>' +
      '</div>' +
      '<form class="modal-form">' +
        opts.html +
        '<div class="modal-err" hidden></div>' +
        '<div class="modal-btns">' +
          (opts.closeLabel
            ? ''
            : '<button type="submit">' + escHtml(opts.submitLabel || '저장') + '</button>') +
          '<button class="modal-cancel" type="button">' +
            escHtml(opts.closeLabel || '취소') + '</button>' +
        '</div>' +
        (opts.onDelete ? '<button class="modal-del" type="button">삭제</button>' : '') +
      '</form>' +
    '</div>';
  document.body.appendChild(el);
  document.body.classList.add('modal-open');
  _modalEl = el;

  el.querySelector('.modal-back').addEventListener('click', modalClose);
  el.querySelector('.modal-x').addEventListener('click', modalClose);
  el.querySelector('.modal-cancel').addEventListener('click', modalClose);
  document.addEventListener('keydown', _modalKey);

  // 일을 끝낸 뒤 이어서 열 화면(onDone)은 반드시 modalClose 다음에 부른다 — 콜백
  // 안에서 다른 모달을 열면 뒤따르는 modalClose가 그 새 모달을 닫아버린다.
  function finish() {
    modalClose();
    if (opts.onDone) opts.onDone();
  }

  var delBtn = el.querySelector('.modal-del');
  if (delBtn) delBtn.addEventListener('click', function () {
    if (opts.deleteConfirm && !confirm(opts.deleteConfirm)) return;
    opts.onDelete();
    finish();
  });

  var form = el.querySelector('.modal-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = opts.onSubmit ? opts.onSubmit(form) : null;
    if (err) {
      var box = el.querySelector('.modal-err');
      box.textContent = err;
      box.hidden = false;
      return;
    }
    finish();
  });

  // 첫 입력칸에 포커스를 준다 — 폰에서 바로 타이핑할 수 있게.
  var first = form.querySelector('input, textarea, select');
  if (first && first.focus) { try { first.focus(); } catch (e) {} }
  return form;
}

function sectionEditorHtml() {
  return '<div class="sec-actions">' +
    '<button class="sec-new" type="button">+ 새 항목</button></div>';
}

// 숙소 탭. 여행 기본 숙소 하나에 일차별 목록이 딸린다 — 여행 중에 호텔을 옮기는
// 일정(오사카 3박 → 교토 2박)이 흔하다. 두 줄 모두 탭하면 편집 모달이 열린다.
function hotelPanelHtml(trip) {
  var days = Array.isArray(trip.days) ? trip.days : [];
  var base = '<button class="hr hr-base" type="button">' +
    '<div class="hr-k">여행 기본</div>' +
    '<div class="hr-v">' +
      (trip.hotel ? itemLinesHtml(trip.hotel)
                  : '<span class="hr-none">숙소를 입력하려면 누르세요</span>') +
    '</div></button>';
  var rows = days.map(function (d) {
    // 오버라이드가 있는 날만 숙소를 되풀이해 적는다 — 매일 같은 호텔인 여행에서
    // 같은 이름이 7번 늘어서 있으면 "어느 날이 다른지"가 오히려 안 보인다.
    var own = d.hotel;
    return '<button class="hr hr-day" type="button" data-n="' + Number(d.n) + '">' +
      '<div class="hr-k">' + Number(d.n) + '일차 ' +
        '<span class="hr-d">' + escHtml(String(d.date).slice(5)) +
        '(' + dowOf(d.date) + ')</span></div>' +
      '<div class="hr-v">' +
        (own ? itemLinesHtml(own)
             : '<span class="hr-same">기본 숙소와 같음</span>') +
      '</div></button>';
  }).join('');
  return '<div class="panel-card"><h2 class="panel-h">🏨 숙소</h2>' +
    '<div class="hrs">' + base + rows + '</div>' +
    '<p class="hr-hint">묵는 곳이 바뀌는 날만 따로 적으면 됩니다.</p></div>';
}

function bindHotelPanel(trip, st, el) {
  function save() {
    if (!saveTripBody(trip)) {
      var fresh = loadTrip(trip.id);
      if (fresh) { trip.hotel = fresh.hotel; trip.days = fresh.days; }
      alert('저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
    }
    renderPanel(trip, st, "hotel");
  }

  // dayN이 null이면 여행 기본 숙소를 고친다.
  function openHotelModal(dayN) {
    var day = dayN === null ? null : findDay(trip, dayN);
    if (dayN !== null && !day) return;
    var cur = dayN === null ? (trip.hotel || '') : (day.hotel || '');
    modalOpen({
      title: dayN === null ? '여행 기본 숙소' : (Number(dayN) + '일차 숙소'),
      submitLabel: '저장',
      // 일차 숙소는 비우면 기본값으로 되돌아간다 — "삭제"보다 그 뜻을 그대로 쓴다.
      onDelete: (dayN !== null && day.hotel) ? function () {
        setDayHotel(trip, dayN, '');
        save();
      } : null,
      html:
        '<label>숙소<textarea class="m-hotel" rows="4" ' +
          'placeholder="예: 포포인츠 신사이바시&#10;체크인 15시 · 체크아웃 11시">' +
          escHtml(cur) + '</textarea></label>' +
        (dayN === null
          ? '<p class="modal-hint">일차별로 따로 적지 않은 날은 모두 이 숙소를 씁니다.</p>'
          : '<p class="modal-hint">비워서 저장하면 여행 기본 숙소를 씁니다.</p>'),
      onSubmit: function (form) {
        var text = form.querySelector('.m-hotel').value;
        if (dayN === null) trip.hotel = String(text).trim();
        else setDayHotel(trip, dayN, text);
        save();
        return null;
      }
    });
  }

  var baseBtn = el.querySelector('.hr-base');
  if (baseBtn) baseBtn.addEventListener('click', function () { openHotelModal(null); });
  el.querySelectorAll('.hr-day').forEach(function (b) {
    b.addEventListener('click', function () { openHotelModal(Number(b.dataset.n)); });
  });
}

// 탭 본문. 일정 탭은 #daytabs/#timeline을 따로 쓰므로 여기서는 빈 문자열.
function panelHtml(trip, tab) {
  if (tab === "hotel") return hotelPanelHtml(trip);
  if (tab === "packing") {
    return '<div class="panel-card" id="packing-body"></div>';
  }
  if (tab === "money") {
    // 내역이 없어도 편집기는 보여야 한다 — 그래야 첫 항목을 넣을 수 있다.
    var exp = '<div class="panel-card"><h2 class="panel-h">💰 출발 전 결제 내역</h2>' +
      ((trip.expenses && trip.expenses.length)
        ? expensesTableHtml(trip)
        : '<p class="sempty">아직 내역이 없습니다.</p>') +
      expenseEditorHtml(trip) + '</div>';
    return '<div class="panel-card" id="spend-body"></div>' + exp;
  }
  if (tab === "info") {
    var secs = trip.sections || [];
    var body = secs.length
      ? secs.map(function (sec, i) {
          // 섹션은 <details>라 제목 탭이 이미 펼치기다 — 일정처럼 "탭하면 수정"으로
          // 만들 수 없어 펼친 내용 아래에 도구줄을 둔다. 삭제는 수정 모달 안에 있다.
          // 표는 편집기가 다루지 않는다(읽기 전용) — 버튼 자체를 내지 않는다.
          var tools = sectionEditable(sec)
            ? '<div class="sec-tools">' +
              '<button class="sec-up" type="button" data-id="' + escHtml(sec.id) + '">↑</button>' +
              '<button class="sec-dn" type="button" data-id="' + escHtml(sec.id) + '">↓</button>' +
              '<button class="sec-ed" type="button" data-id="' + escHtml(sec.id) + '">수정</button>' +
              '</div>'
            : '<div class="sec-tools"><span class="sec-ro">표는 여기서 수정할 수 없습니다</span></div>';
          return '<details' + (i === 0 ? ' open' : '') + '>' +
            '<summary>' + escHtml(sec.icon) + ' ' + escHtml(sec.title) + '</summary>' +
            '<div class="acc">' + sectionBodyHtml(trip, sec) + tools + '</div></details>';
        }).join('')
      : '<p class="empty">시간표·메모처럼 직접 만드는 항목이 여기 표시됩니다.</p>';
    return body + sectionEditorHtml();
  }
  return '';
}

function renderPanel(trip, st, tab) {
  var el = document.getElementById("tab-panel");
  if (!el) return;
  el.innerHTML = panelHtml(trip, tab);
  if (tab === "hotel") bindHotelPanel(trip, st, el);
  if (tab === "packing") renderPacking(trip, st);
  if (tab === "money") renderSpend(trip, st);
  if (tab === "info") bindSectionEditor(trip, st, el);
  if (tab === "money") bindExpenseEditor(trip, st, el);
}

// 섹션을 고쳐 저장하고 정보 탭만 다시 그린다. saveTripBody의 성공 여부를 확인한다 —
// 조용히 실패하면 화면에는 반영됐는데 저장은 안 된 상태가 된다.
function saveSections(trip, st, el) {
  var ok = saveTripBody(trip);
  if (!ok) {
    var fresh = loadTrip(trip.id);
    if (fresh) trip.sections = fresh.sections;
    alert('저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
  }
  renderPanel(trip, st, "info");
}

function bindExpenseEditor(trip, st, el) {
  function save() {
    if (!saveTripBody(trip)) {
      var fresh = loadTrip(trip.id);
      if (fresh) trip.expenses = fresh.expenses;
      alert('저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
    }
    renderPanel(trip, st, "money");
  }

  function openForm(e) {
    modalOpen({
      title: e ? '내역 수정' : '내역 추가',
      submitLabel: e ? '저장' : '추가',
      onDelete: e ? function () { removeExpense(trip, e.id); save(); } : null,
      deleteConfirm: e ? ('"' + e.cat + '" 내역을 삭제할까요?') : null,
      html:
        '<label>항목<input class="exp-cat" type="text" required ' +
          'placeholder="예: 항공권" value="' + escHtml(e ? e.cat : '') + '"></label>' +
        '<label>금액(원)<input class="exp-krw" type="number" min="1" step="1" required ' +
          'placeholder="640000" value="' + (e ? Number(e.krw) : '') + '"></label>' +
        '<label>상세<input class="exp-detail" type="text" ' +
          'placeholder="예: 왕복 2인" value="' + escHtml(e ? (e.detail || '') : '') + '"></label>' +
        '<div class="modal-row">' +
          '<label>결제일<input class="exp-date" type="date" ' +
            'value="' + escHtml(e ? (e.date || '') : '') + '"></label>' +
          '<label>결제수단<input class="exp-pay" type="text" ' +
            'placeholder="신한카드" value="' + escHtml(e ? (e.pay || '') : '') + '"></label>' +
        '</div>',
      onSubmit: function (form) {
        var f = {
          cat: form.querySelector('.exp-cat').value,
          krw: form.querySelector('.exp-krw').value,
          detail: form.querySelector('.exp-detail').value,
          date: form.querySelector('.exp-date').value,
          pay: form.querySelector('.exp-pay').value,
          note: ''
        };
        var err = validateExpenseForm(f);
        if (err) return err;
        if (e) updateExpense(trip, e.id, f);
        else addExpense(trip, f);
        save();
        return null;
      }
    });
  }

  var newBtn = el.querySelector('.exp-new');
  if (newBtn) newBtn.addEventListener('click', function () { openForm(null); });

  el.querySelectorAll('.exp-r').forEach(function (tr) {
    function open() {
      var e = (trip.expenses || []).filter(function (x) { return x.id === tr.dataset.id; })[0];
      if (e) openForm(e);
    }
    tr.addEventListener('click', open);
    // <tr>은 버튼이 아니라 키보드로는 열리지 않는다 — Enter/Space를 직접 받는다.
    tr.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
    });
  });
}

function bindSectionEditor(trip, st, el) {
  function openForm(sec) {
    var t = sec ? sec.type : 'list';
    modalOpen({
      title: sec ? '항목 수정' : '새 항목',
      submitLabel: sec ? '저장' : '추가',
      onDelete: sec ? function () {
        removeSection(trip, sec.id);
        saveSections(trip, st, el);
      } : null,
      deleteConfirm: sec ? ('"' + sec.title + '" 항목을 삭제할까요?') : null,
      html:
        '<div class="modal-row">' +
          '<label class="m-narrow">아이콘<input class="sec-icon" type="text" maxlength="2" ' +
            'placeholder="📌" value="' + escHtml(sec ? sec.icon : '') + '"></label>' +
          '<label>제목<input class="sec-title" type="text" required ' +
            'placeholder="예: 맛집 목록" value="' + escHtml(sec ? sec.title : '') + '"></label>' +
        '</div>' +
        '<label>형식<select class="sec-type">' +
          '<option value="list"' + (t === 'list' ? ' selected' : '') + '>목록 — 한 줄에 하나씩</option>' +
          '<option value="text"' + (t === 'text' ? ' selected' : '') + '>글 — 줄바꿈 그대로</option>' +
        '</select></label>' +
        '<label>내용<textarea class="sec-body" rows="6">' +
          escHtml(sec ? sectionBodyToText(sec) : '') + '</textarea></label>',
      onSubmit: function (form) {
        var f = {
          icon: form.querySelector('.sec-icon').value,
          title: form.querySelector('.sec-title').value,
          type: form.querySelector('.sec-type').value,
          body: form.querySelector('.sec-body').value
        };
        var err = validateSectionForm(f);
        if (err) return err;
        if (sec) updateSection(trip, sec.id, f);
        else addSection(trip, f);
        saveSections(trip, st, el);
        return null;
      }
    });
  }

  var newBtn = el.querySelector('.sec-new');
  if (newBtn) newBtn.addEventListener('click', function () { openForm(null); });

  el.querySelectorAll('.sec-ed').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = (trip.sections || []).filter(function (s) { return s.id === b.dataset.id; })[0];
      if (sec) openForm(sec);
    });
  });
  el.querySelectorAll('.sec-up').forEach(function (b) {
    b.addEventListener('click', function () {
      moveSection(trip, b.dataset.id, -1);
      saveSections(trip, st, el);
    });
  });
  el.querySelectorAll('.sec-dn').forEach(function (b) {
    b.addEventListener('click', function () {
      moveSection(trip, b.dataset.id, 1);
      saveSections(trip, st, el);
    });
  });

}

function renderTabbar(trip, tab, onSelect) {
  var nav = document.getElementById("tabbar");
  if (!nav) return;
  nav.innerHTML = TAB_DEFS.map(function (t) {
    var on = t.key === tab ? ' data-selected="1"' : '';
    return '<button class="tb"' + on + ' data-tab="' + escHtml(t.key) + '"' +
      ' aria-current="' + (t.key === tab ? 'page' : 'false') + '">' +
      '<span class="tb-i">' + t.icon + '</span>' +
      '<span class="tb-l">' + escHtml(t.label) + '</span></button>';
  }).join('');
  nav.querySelectorAll('.tb').forEach(function (b) {
    b.addEventListener('click', function () { onSelect(b.dataset.tab); });
  });
}


// renderSpend는 #spend-body를 통째로 다시 그린다 — 목록·합계·환율이 한 덩어리라
// 부분 갱신이 오히려 복잡하다. 대신 추가 폼에 치던 값은 보존한다: 항목을 하나
// 삭제하거나 환율을 고치는 것만으로 입력 중이던 금액·내용이 사라지면 안 된다.
// 제출 경로는 값을 비우는 게 맞으므로 그쪽에서 명시적으로 지운다.
function renderSpend(trip, st) {
  const body = document.getElementById("spend-body");
  if (!body) return;
  const keepAmt = (body.querySelector('.samt-in') || {}).value || '';
  const keepNote = (body.querySelector('.snote-in') || {}).value || '';
  const keepCat = (body.querySelector('.scat-in') || {}).value || '';
  const keepCur = (body.querySelector('.scur-in') || {}).value || '';
  const list = spendList(st);
  const rates = fxRates(st);
  const totals = spendTotals(list);

  // 통화가 여럿이면 한 줄에 담을 수 없다 — 통화별로 줄을 나누고 맨 아래 원화 총합을 둔다.
  var sum = 0, partial = false;
  totals.forEach(function (t) {
    var k = toKRW(t.amount, t.cur, rates);
    if (k === null) partial = true; else sum += k;
  });
  const totalHtml = totals.length
    ? '<div class="stotal">' + totals.map(function (t) {
        var k = toKRW(t.amount, t.cur, rates);
        return '<div class="stot-row">' + escHtml(fmtAmount(t.amount, currencyByCode(t.cur))) +
          (k === null ? ' <span class="skrw">(환율 없음)</span>'
                      : ' <span class="skrw">(약 ' + escHtml(fmtKRW(k)) + ')</span>') + '</div>';
      }).join('') +
      (totals.length > 1 && sum
        ? '<div class="stot-sum">합계 약 ' + escHtml(fmtKRW(sum)) + (partial ? '+' : '') + '</div>'
        : '') + '</div>'
    : '';

  const chips = spendByCat(list).map(function (c) {
    return '<li>' + escHtml(c.cat) + ' <b>' +
      escHtml(fmtAmount(c.amount, currencyByCode(c.cur))) + '</b></li>';
  }).join('');

  const groups = spendByDate(list).map(function (g) {
    const rows = g.items.map(function (e) {
      return '<li><span class="scat">' + escHtml(e.cat) + '</span>' +
        '<span class="snote">' + escHtml(e.note || e.cat) + '</span>' +
        '<span class="samt">' + escHtml(fmtAmount(e.amount, currencyByCode(e.cur))) + '</span>' +
        '<button class="spend-del" type="button" data-id="' + escHtml(e.id) +
        '" aria-label="삭제">×</button></li>';
    }).join('');
    return '<div class="sgroup"><div class="sdate">' + escHtml(g.date) + '</div>' +
      '<ul class="slist">' + rows + '</ul></div>';
  }).join('');

  // 기본 통화는 지금 보고 있는 일차의 통화다(없으면 여행 기본값) — 일차마다 다를 수 있다.
  const day = (typeof CUR !== 'undefined' && CUR.dayN)
    ? (trip.days || []).filter(function (d) { return d.n === CUR.dayN; })[0] : null;
  const defCur = currencyByCode((dayCurrency(trip, day) || {}).code || 'KRW');
  const defCode = defCur.code;
  // 프리셋에 없는 통화(사용자가 직접 넣은 코드)도 목록에 넣어야 고를 수 있다.
  const codes = CURRENCIES.map(function (c) { return c.code; });
  if (codes.indexOf(defCode) === -1) codes.unshift(defCode);
  const curOpts = codes.map(function (c) {
    const on = (keepCur || defCode) === c ? ' selected' : '';
    return '<option value="' + escHtml(c) + '"' + on + '>' + escHtml(c) + '</option>';
  }).join('');

  // 소수점 통화는 step을 0.01로 — JPY에 12.5를 넣을 수 없게, USD에는 넣을 수 있게.
  const step = defCur.decimals > 0 ? '0.01' : '1';

  // 수동 환율은 "unit당 원화"로 받는다(100엔 = ○○원). 저장은 1단위 기준으로 정규화한다.
  const manual = st.get("fxManual", {}) || {};
  const autoRate = rates[defCode];
  const hasManual = manual[defCode] !== undefined && Number(manual[defCode]) > 0;
  const shownKrw = hasManual
    ? Math.round(Number(manual[defCode]) * defCur.unit * 100) / 100
    : (autoRate ? Math.round(defCur.unit / autoRate) : '');
  const fxRow = defCode === 'KRW' ? '' :
    '<div class="sfx">' + escHtml(defCur.unit.toLocaleString('ko-KR') + defCur.name) +
    ' = <input class="sfx-in" type="number" min="0" step="0.01" value="' +
    escHtml(shownKrw) + '"> 원' +
    (hasManual ? ' <button class="sfx-clr" type="button">자동</button>' : '') +
    '</div>';

  body.innerHTML =
    totalHtml +
    (chips ? '<ul class="scats">' + chips + '</ul>' : '') +
    '<form class="spend-add">' +
      '<input class="samt-in" type="number" inputmode="decimal" min="0" step="' + step + '" ' +
        'placeholder="금액" aria-label="금액">' +
      '<select class="scur-in" aria-label="통화">' + curOpts + '</select>' +
      '<input class="snote-in" type="text" placeholder="내용" aria-label="내용">' +
      '<select class="scat-in" aria-label="분류">' +
        SPEND_CATS.map(function (c) { return '<option>' + escHtml(c) + '</option>'; }).join('') +
      '</select>' +
      '<button type="submit">추가</button>' +
    '</form>' +
    (groups || '<div class="sempty">아직 기록이 없습니다.</div>') +
    fxRow +
    // 무료 등급 이용 조건상 출처 표기가 필수다.
    '<div class="fx-attrib-row">' + FX_ATTRIB_HTML + '</div>';

  const form = body.querySelector('.spend-add');
  if (keepAmt) form.querySelector('.samt-in').value = keepAmt;
  if (keepNote) form.querySelector('.snote-in').value = keepNote;
  if (keepCat) form.querySelector('.scat-in').value = keepCat;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const ain = form.querySelector('.samt-in');
    const code = form.querySelector('.scur-in').value;
    const c = currencyByCode(code);
    // 소수점 자릿수에 맞춰 반올림한다 — JPY에 12.5를 넣으면 13이 된다.
    const p = Math.pow(10, c.decimals);
    const amount = Math.round(Number(ain.value) * p) / p;
    if (!isFinite(amount) || amount <= 0) { ain.focus(); return; }
    const cur = spendList(st);
    let id = Date.now();
    while (cur.some(function (x) { return x.id === id; })) id++;
    cur.push({
      id: id,
      date: todayLocal(),
      amount: amount,
      cur: code,
      cat: form.querySelector('.scat-in').value,
      note: form.querySelector('.snote-in').value.trim()
    });
    st.set("spend", cur);
    // 방금 기록한 값이 폼에 되살아나지 않도록 명시적으로 비운다.
    ain.value = '';
    form.querySelector('.snote-in').value = '';
    renderSpend(trip, st);
    renderSummary(trip, st);
    const next = body.querySelector('.samt-in');
    if (next) next.focus();
  });

  body.querySelectorAll('.spend-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = Number(btn.dataset.id);
      st.set("spend", spendList(st).filter(function (x) { return x.id !== id; }));
      renderSpend(trip, st);
      renderSummary(trip, st);
    });
  });

  // 통화를 바꾸면 금액 입력의 step도 따라가야 한다 — 여행 기본값이 JPY(step=1)인데
  // USD를 고르면 12.50을 넣을 수 없다(HTML5 검증에 걸려 제출 자체가 막힌다).
  const curin = body.querySelector('.scur-in');
  if (curin) curin.addEventListener('change', function () {
    const c = currencyByCode(curin.value);
    const ain = body.querySelector('.samt-in');
    if (ain) ain.step = c.decimals > 0 ? '0.01' : '1';
  });

  const fxin = body.querySelector('.sfx-in');
  if (fxin) fxin.addEventListener('change', function () {
    const krwPerUnit = Number(fxin.value);
    const m = st.get("fxManual", {}) || {};
    // 비우거나 0을 넣으면 자동값으로 돌아간다.
    if (isFinite(krwPerUnit) && krwPerUnit > 0) m[defCode] = krwPerUnit / defCur.unit;
    else delete m[defCode];
    st.set("fxManual", m);
    renderSpend(trip, st);
    renderSummary(trip, st);
  });

  const fxclr = body.querySelector('.sfx-clr');
  if (fxclr) fxclr.addEventListener('click', function () {
    const m = st.get("fxManual", {}) || {};
    delete m[defCode];
    st.set("fxManual", m);
    renderSpend(trip, st);
    renderSummary(trip, st);
  });
}

function renderPacking(trip, st) {
  const body = document.getElementById("packing-body");
  if (!body) return;
  const customs = st.get("packing_add", []);
  const checked = st.get("packing_checked", {});
  const items = trip.packing.map(function (t) { return { text: t, custom: false }; })
    .concat(customs.map(function (t) { return { text: t, custom: true }; }));
  body.innerHTML =
    '<ul class="packlist">' + items.map(function (it) {
      const on = checked[it.text] ? ' checked' : '';
      const doneCls = checked[it.text] ? ' class="done"' : '';
      const del = it.custom
        ? '<button class="pack-del" type="button" data-text="' + escHtml(it.text) + '" aria-label="삭제">×</button>'
        : '';
      return '<li' + doneCls + '><label><input type="checkbox" data-text="' + escHtml(it.text) + '"' +
        on + '> ' + escHtml(it.text) + '</label>' + del + '</li>';
    }).join('') + '</ul>' +
    '<form class="pack-add"><input type="text" placeholder="준비물 추가" aria-label="준비물 추가">' +
    '<button type="submit">추가</button></form>';

  body.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const c = st.get("packing_checked", {});
      c[cb.dataset.text] = cb.checked;
      st.set("packing_checked", c);
      cb.closest('li').classList.toggle('done', cb.checked);
    });
  });
  body.querySelectorAll('.pack-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const list = st.get("packing_add", []).filter(function (t) { return t !== btn.dataset.text; });
      st.set("packing_add", list);
      renderPacking(trip, st);
    });
  });
  const form = body.querySelector('.pack-add');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const inp = form.querySelector('input');
    const v = inp.value.trim();
    if (!v) return;
    const list = st.get("packing_add", []);
    if (list.indexOf(v) === -1 && trip.packing.indexOf(v) === -1) {
      list.push(v);
      st.set("packing_add", list);
    }
    renderPacking(trip, st);
    const nextInput = body.querySelector('.pack-add input');
    if (nextInput) nextInput.focus();
  });
}
