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

// 여행 화면의 편집 토글 상태. 여행을 넘나들거나 새로고침하면 꺼진 상태로 돌아간다 —
// 세션에 묶인 UI 상태일 뿐 trip 데이터가 아니므로 저장소에 넣지 않는다.
var EDIT_MODE = false;

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
    // 편집 토글은 일정 탭에서만 의미가 있다. CUR은 app.js에 있고 런타임에만
    // 참조되므로 로드 순서 문제는 없다. 앱 화면이 없는 test.html에서는 CUR이
    // 없을 수 있으므로 typeof로 막는다.
    ((typeof CUR !== 'undefined' && CUR.tab !== 'day')
      ? ''
      : '<button class="edit-mode" type="button" aria-pressed="' + (EDIT_MODE ? 'true' : 'false') +
        '">' + (EDIT_MODE ? '완료' : '편집') + '</button>') +
    '<div class="dday">' + dday(today, trip.start, trip.end) + '</div>' +
    '<h1>' + escHtml(trip.title) + '</h1>' +
    '<div class="period">' + escHtml(trip.start) + ' ~ ' + escHtml(trip.end) +
      ' · ' + nights + '박 ' + (nights + 1) + '일</div>' +
    // 숙소는 여러 줄 textarea다(editor.js) — day.theme과 같은 방식으로 줄바꿈을
    // 가운뎃점으로 이어 한 줄에 눌러 담는다. 그냥 두면 줄바꿈이 사라져 붙어 보인다.
    (trip.hotel ? '<div class="hotel">🏨 ' + escHtml(trip.hotel).replace(/\n/g, ' · ') + '</div>' : '') +
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
  var mb = el.querySelector('.edit-mode');
  if (mb) mb.addEventListener('click', function () {
    // showTrip(trip.id, ...)로는 안 된다 — 같은 여행을 다시 "열게" 되면 opening 경로를
    // 타서 #fixed 전체가 다시 그려지며 열어 둔 아코디언이 닫힌다(showDay 위 주석 참고).
    // showDay(trip, CUR.dayN)도 안 된다 — 그건 renderTabs를 다시 불러 탭 목록의
    // scrollIntoView가 실행되는데, 여기서 바뀐 건 EDIT_MODE뿐이라 탭은 그대로다(wxRepaint가
    // 같은 이유로 renderTimeline을 직접 부르는 것과 동일한 사정 — app.js의 repaintDay 참고).
    // 여기서는 요약(토글 버튼 자체)과 타임라인(수정/삭제 버튼)만 다시 그리면 된다.
    EDIT_MODE = !EDIT_MODE;
    renderSummary(trip, CUR.st);
    repaintDay(trip, CUR.dayN, CUR.st);
  });
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

// EDIT_MODE에서 일정 추가·수정·삭제 후 공통으로 거치는 경로.
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

// 썸네일의 src를 채우고(비동기), 편집 모드면 추가·삭제를 잇는다.
// IndexedDB가 없는 환경(file://, 일부 브라우저)에서는 조용히 넘어간다 —
// 이미지 첨부만 동작하지 않고 앱의 나머지는 그대로 쓸 수 있어야 한다.
function bindDayImages(trip, day, st, root) {
  root.querySelectorAll('.dayimg').forEach(function (fig) {
    var id = fig.dataset.img;
    imgUrl(id).then(function (url) {
      var im = fig.querySelector('img');
      if (!im) return;
      if (url) im.src = url;
      else fig.remove();   // 저장소에서 사라진 사진은 자리만 차지한다
    }).catch(function () { fig.remove(); });
  });

  if (!EDIT_MODE) return;

  root.querySelectorAll('.img-del').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!confirm('이 사진을 삭제할까요?')) return;
      var id = b.dataset.img;
      detachImage(day, id);
      var ok = saveTripBody(trip);
      if (!ok) {
        var fresh = loadTrip(trip.id);
        if (fresh) trip.days = fresh.days;
        alert('저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
      } else {
        imgForget(id);
        imgDel(id).catch(function () {});
      }
      repaintDay(trip, day.n, st);
    });
  });

  var input = root.querySelector('.img-add input[type=file]');
  if (!input) return;
  input.addEventListener('change', function () {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    if (!imgAvailable()) {
      alert('이 환경에서는 사진을 저장할 수 없습니다. 주소창으로 앱을 열어 주세요.');
      input.value = '';
      return;
    }
    var lbl = root.querySelector('.img-add');
    if (lbl) lbl.classList.add('busy');
    // 한 장씩 차례로 처리한다 — 큰 사진 여러 장을 동시에 디코딩하면 폰에서 버겁다.
    files.reduce(function (chain, file) {
      return chain.then(function () {
        return imgShrink(file).then(function (blob) {
          var id = newImageId();
          return imgPut(id, blob).then(function () { attachImage(day, id); });
        });
      }).catch(function () { /* 못 읽는 파일 하나 때문에 나머지를 막지 않는다 */ });
    }, Promise.resolve()).then(function () {
      if (lbl) lbl.classList.remove('busy');
      input.value = '';
      if (!saveTripBody(trip)) {
        var fresh = loadTrip(trip.id);
        if (fresh) trip.days = fresh.days;
        alert('저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
      }
      repaintDay(trip, day.n, st);
    });
  });
}

// 일차에 붙은 사진. src는 비워 두고 렌더 후 IndexedDB에서 읽어 채운다 —
// blob URL은 동기적으로 만들 수 없기 때문이다(bindDayImages 참고).
function imagesHtml(day) {
  var ids = (day && Array.isArray(day.images)) ? day.images : [];
  if (!ids.length && !EDIT_MODE) return '';
  var thumbs = ids.map(function (id) {
    return '<figure class="dayimg" data-img="' + escHtml(id) + '">' +
      '<img alt="" loading="lazy">' +
      (EDIT_MODE ? '<button class="img-del" type="button" data-img="' + escHtml(id) +
        '" aria-label="사진 삭제">×</button>' : '') +
      '</figure>';
  }).join('');
  var adder = EDIT_MODE
    ? '<label class="img-add">+ 사진 추가' +
      '<input type="file" accept="image/*" multiple hidden></label>'
    : '';
  return '<div class="dayimgs">' + thumbs + adder + '</div>';
}

function renderTimeline(trip, day, st) {
  const main = document.getElementById("timeline");
  const slots = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    const btns = EDIT_MODE
      ? '<div class="slot-btns">' +
        '<button class="it-edit" type="button" data-id="' + escHtml(it.id) + '">수정</button>' +
        '<button class="it-del" type="button" data-id="' + escHtml(it.id) + '">삭제</button></div>'
      : '';
    return '<div class="slot' + cls + '" data-item="' + escHtml(it.id) + '">' +
      '<div class="time">' + escHtml(it.time) + '</div>' +
      '<div class="what">' + itemLinesHtml(it.text) + btns + '</div></div>';
  }).join('');
  // 새로 만든 여행의 1일차는 일정이 하나도 없다. 편집 모드가 아니면 추가 폼도 없어서
  // 예전에는 완전히 빈 카드만 보였다 — 무엇을 해야 하는지 알려 주는 줄을 넣는다.
  // 편집 모드에서는 바로 아래에 추가 폼이 있으므로 안내가 필요 없다.
  const rows = slots || (EDIT_MODE
    ? ''
    : '<p class="empty">아직 일정이 없습니다. 편집을 눌러 추가해 보세요.</p>');
  // 자유 메모. 예전의 "뭐먹지"(엑셀에서 온 문구 + 답 입력칸)를 대체한다 —
  // 그 틀에 맞지 않는 메모(예약 번호, 챙길 것)를 적을 곳이 없었다.
  const noteList = Array.isArray(day.notes) ? day.notes : [];
  const notes = (noteList.length || EDIT_MODE)
    ? '<div class="notes"><div class="notes-h">📝 메모</div>' +
      (noteList.length
        ? noteList.map(function (n) {
            return '<div class="note"><div class="note-text">' + itemLinesHtml(n.text) + '</div>' +
              (EDIT_MODE
                ? '<div class="note-btns">' +
                  '<button class="nt-edit" type="button" data-id="' + escHtml(n.id) + '">수정</button>' +
                  '<button class="nt-del" type="button" data-id="' + escHtml(n.id) + '">삭제</button>' +
                  '</div>'
                : '') + '</div>';
          }).join('')
        : '<p class="notes-empty">아직 메모가 없습니다.</p>') +
      (EDIT_MODE
        ? '<form class="note-add">' +
          '<textarea class="nt-text" rows="2" placeholder="메모 (예: 스시야 19시 예약)" ' +
            'required aria-label="메모"></textarea>' +
          '<button type="submit">메모 추가</button></form>'
        : '') +
      '</div>'
    : '';
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + Number(day.n) + '일차</span> ' +
      '<span class="ddate">' + escHtml(day.date) + '(' + dowOf(day.date) + ')</span>' +
      '<div class="dtheme">' + escHtml(day.theme).replace(/\n/g, ' · ') + '</div>' +
      (function () {
        // 그 일차에 지정된 도시(없으면 여행 기본값)의 예보를 쓴다.
        var dp = dayPlace(trip, day);
        // 배지는 여행 기본 도시와 다른 일차에만 붙인다 — 모든 일차에 붙이면
        // 단일 도시 여행에서 같은 이름이 일곱 번 반복돼 소음이 된다.
        var moved = dp && trip.place && wxKey(dp) !== wxKey(trip.place);
        var badge = moved ? '<span class="daycity">📍 ' + escHtml(dp.name) + '</span>' : '';
        var line = wxLine(wxGet(st, dp).map, day.date);
        var wx = line ? '<div class="dwx">' + line + wxStamp(dp) + '</div>' : '';
        return badge + wx;
      })() + '</div>' +
      imagesHtml(day) +
      '<div class="slots">' + rows + '</div>' +
      (EDIT_MODE
        ? '<form class="item-add">' +
          '<input class="ia-time" type="time" step="300" required aria-label="시간">' +
          '<textarea class="ia-text" rows="2" placeholder="일정 내용" required ' +
            'aria-label="일정 내용"></textarea>' +
          '<button type="submit">일정 추가</button></form>'
        : '') +
      notes + '</div>';
  bindDayImages(trip, day, st, main);

  if (EDIT_MODE) {
    main.querySelectorAll('.nt-del').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('이 메모를 삭제할까요?')) return;
        removeNote(day, b.dataset.id);
        afterItemEdit(trip, day, st, saveTripBody(trip));
      });
    });
    main.querySelectorAll('.nt-edit').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = (day.notes || []).filter(function (x) { return x.id === b.dataset.id; })[0];
        if (!n) return;
        var text = prompt('메모', n.text);
        if (text === null) return;
        if (!String(text).trim()) { alert(MSG_EMPTY_TEXT); return; }
        updateNote(day, n.id, text);
        afterItemEdit(trip, day, st, saveTripBody(trip));
      });
    });
    var nf = main.querySelector('.note-add');
    if (nf) nf.addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = nf.querySelector('.nt-text');
      var text = ta.value.trim();
      if (!text) { alert(MSG_EMPTY_TEXT); return; }
      addNote(day, text);
      ta.value = '';
      afterItemEdit(trip, day, st, saveTripBody(trip));
    });
  }

  main.querySelectorAll('.memo').forEach(function (inp) {
    inp.addEventListener('input', function () { st.set(inp.dataset.key, inp.value); });
  });
  if (EDIT_MODE) {
    main.querySelectorAll('.it-del').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirm('이 일정을 삭제할까요?')) return;
        removeItem(trip, day.n, b.dataset.id);
        afterItemEdit(trip, day, st, saveTripBody(trip));
      });
    });
    main.querySelectorAll('.it-edit').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = day.items.filter(function (x) { return x.id === b.dataset.id; })[0];
        if (!it) return;
        var time = prompt('시간 (HH:MM)', it.time);
        if (time === null) return;
        // 추가 폼은 <input type=time>이 형식을 강제하지만 prompt()는 아무 문자열이나
        // 받는다 — '9:00'처럼 자릿수만 틀린 흔한 실수는 정규화해서 받아주고, 그 밖의
        // ('9시', 'abc' 등) 잘못된 값은 저장하지 않고 알린다. 정규화 없이 그대로 저장하면
        // sortItems의 사전순 비교에서 '9:00'이 '14:00'보다 뒤로 밀려버린다(review 지적).
        var normTime = normalizeTimeInput(time);
        if (!normTime) {
          alert(MSG_BAD_TIME);
          return;
        }
        var text = prompt('일정 내용', it.text);
        if (text === null) return;
        text = text.trim();
        // 추가 폼(item-add)은 빈 내용을 거부한다(required + trim 확인) — prompt 경로만
        // 빈 문자열을 그대로 받아주면 "시간만 있고 내용은 빈" undecided 행이 생긴다.
        // 두 입력 경로의 보장을 맞춘다.
        if (!text) {
          alert(MSG_EMPTY_TEXT);
          return;
        }
        updateItem(trip, day.n, it.id, { time: normTime, text: text });
        afterItemEdit(trip, day, st, saveTripBody(trip));
      });
    });
    var af = main.querySelector('.item-add');
    if (af) af.addEventListener('submit', function (e) {
      e.preventDefault();
      // required 속성이 막아 주는 "아무것도 안 채운 제출"은 조용히 무시하고, 실제로
      // 값이 들어왔는데 형식이 틀린 경우만 알린다(parseItemInput — prompt 경로와 동일한
      // 검증·메시지를 쓴다).
      var raw = af.querySelector('.ia-time').value;
      var rawText = af.querySelector('.ia-text').value;
      if (!raw && !rawText.trim()) return;
      var p = parseItemInput(raw, rawText);
      if (!p.ok) { alert(p.message); return; }
      addItem(trip, day.n, { time: p.time, text: p.text });
      afterItemEdit(trip, day, st, saveTripBody(trip));
    });
  }
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
  const rows = trip.expenses.map(function (e) {
    return '<tr><td>' + escHtml(e.cat) + '</td><td>' + escHtml(e.detail) + '</td>' +
      '<td class="num">' + Number(e.krw).toLocaleString('ko-KR') + '</td></tr>';
  }).join('');
  const total = trip.expenses.reduce(function (s, e) { return s + Number(e.krw || 0); }, 0);
  return '<div class="tblwrap"><table>' +
    '<thead><tr><th>항목</th><th>상세</th><th class="num">금액(원)</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '<tfoot><tr><td colspan="2">합계</td><td class="num">' +
      total.toLocaleString('ko-KR') + '</td></tr></tfoot></table></div>';
}

// 정보 탭의 섹션 편집 모드. EDIT_MODE와 같은 성격의 세션 상태다 —
// trip 데이터가 아니므로 저장소에 넣지 않는다.
var SECT_EDIT = false;
// 편집 중인 섹션 id. null이면 "새로 추가" 상태다.
var SECT_TARGET = null;

function sectionEditorHtml() {
  if (!SECT_EDIT) {
    return '<div class="sec-actions">' +
      '<button class="sec-mode" type="button">✏️ 항목 편집</button></div>';
  }
  return '<div class="sec-actions">' +
      '<button class="sec-mode" type="button" data-on="1">완료</button>' +
      '<button class="sec-new" type="button">+ 새 항목</button>' +
    '</div>' +
    '<form class="sec-form" hidden>' +
      '<div class="sec-row">' +
        '<input class="sec-icon" type="text" maxlength="2" placeholder="📌" aria-label="아이콘">' +
        '<input class="sec-title" type="text" placeholder="제목 (예: 맛집 목록)" aria-label="제목">' +
      '</div>' +
      '<select class="sec-type" aria-label="형식">' +
        '<option value="list">목록 — 한 줄에 하나씩</option>' +
        '<option value="text">글 — 줄바꿈 그대로</option>' +
      '</select>' +
      '<textarea class="sec-body" rows="5" placeholder="내용" aria-label="내용"></textarea>' +
      '<div class="sec-err" hidden></div>' +
      '<div class="sec-row">' +
        '<button type="submit">저장</button>' +
        '<button class="sec-cancel" type="button">취소</button>' +
      '</div>' +
    '</form>';
}

// 탭 본문. 일정 탭은 #daytabs/#timeline을 따로 쓰므로 여기서는 빈 문자열.
function panelHtml(trip, tab) {
  if (tab === "hotel") {
    return trip.hotel
      ? '<div class="panel-card">' + itemLinesHtml(trip.hotel) + '</div>'
      : '<p class="empty">숙소가 아직 없습니다. ⚙ 여행 설정에서 입력할 수 있습니다.</p>';
  }
  if (tab === "packing") {
    return '<div class="panel-card" id="packing-body"></div>';
  }
  if (tab === "money") {
    var exp = (trip.expenses && trip.expenses.length)
      ? '<div class="panel-card"><h2 class="panel-h">💰 출발 전 결제 내역</h2>' +
        expensesTableHtml(trip) + '</div>'
      : '';
    return '<div class="panel-card" id="spend-body"></div>' + exp;
  }
  if (tab === "info") {
    var secs = trip.sections || [];
    var body = secs.length
      ? secs.map(function (sec, i) {
          // 표는 편집기가 다루지 않는다(읽기 전용) — 버튼 자체를 내지 않는다.
          var tools = SECT_EDIT && sectionEditable(sec)
            ? '<div class="sec-tools">' +
              '<button class="sec-up" type="button" data-id="' + escHtml(sec.id) + '">↑</button>' +
              '<button class="sec-dn" type="button" data-id="' + escHtml(sec.id) + '">↓</button>' +
              '<button class="sec-ed" type="button" data-id="' + escHtml(sec.id) + '">수정</button>' +
              '<button class="sec-rm" type="button" data-id="' + escHtml(sec.id) + '">삭제</button>' +
              '</div>'
            : (SECT_EDIT
                ? '<div class="sec-tools"><span class="sec-ro">표는 여기서 수정할 수 없습니다</span></div>'
                : '');
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
  if (tab === "packing") renderPacking(trip, st);
  if (tab === "money") renderSpend(trip, st);
  if (tab === "info") bindSectionEditor(trip, st, el);
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

function bindSectionEditor(trip, st, el) {
  var form = el.querySelector('.sec-form');

  var modeBtn = el.querySelector('.sec-mode');
  if (modeBtn) modeBtn.addEventListener('click', function () {
    SECT_EDIT = !SECT_EDIT;
    SECT_TARGET = null;
    renderPanel(trip, st, "info");
  });

  function openForm(sec) {
    if (!form) return;
    SECT_TARGET = sec ? sec.id : null;
    form.querySelector('.sec-icon').value = sec ? sec.icon : '';
    form.querySelector('.sec-title').value = sec ? sec.title : '';
    form.querySelector('.sec-type').value = sec ? sec.type : 'list';
    form.querySelector('.sec-body').value = sec ? sectionBodyToText(sec) : '';
    form.querySelector('.sec-err').hidden = true;
    form.hidden = false;
    form.querySelector('.sec-title').focus();
  }

  var newBtn = el.querySelector('.sec-new');
  if (newBtn) newBtn.addEventListener('click', function () { openForm(null); });

  el.querySelectorAll('.sec-ed').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = (trip.sections || []).filter(function (s) { return s.id === b.dataset.id; })[0];
      if (sec) openForm(sec);
    });
  });
  el.querySelectorAll('.sec-rm').forEach(function (b) {
    b.addEventListener('click', function () {
      var sec = (trip.sections || []).filter(function (s) { return s.id === b.dataset.id; })[0];
      if (!sec) return;
      if (!confirm('"' + sec.title + '" 항목을 삭제할까요?')) return;
      removeSection(trip, b.dataset.id);
      saveSections(trip, st, el);
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

  if (form) {
    form.querySelector('.sec-cancel').addEventListener('click', function () {
      form.hidden = true;
      SECT_TARGET = null;
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = {
        icon: form.querySelector('.sec-icon').value,
        title: form.querySelector('.sec-title').value,
        type: form.querySelector('.sec-type').value,
        body: form.querySelector('.sec-body').value
      };
      var err = validateSectionForm(f);
      var box = form.querySelector('.sec-err');
      if (err) { box.textContent = err; box.hidden = false; return; }
      if (SECT_TARGET) updateSection(trip, SECT_TARGET, f);
      else addSection(trip, f);
      SECT_TARGET = null;
      saveSections(trip, st, el);
    });
  }
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
