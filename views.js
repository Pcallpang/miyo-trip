// 렌더 계층: DOM에 그리는 함수만 모은다.
// trip(여행 본체)과 st(tripStore)를 인자로 받는다 — 전역 여행/저장소를 읽지 않는다.
// schema.js 다음, app.js 앞에 로드된다 (dowOf/daysBetween 사용, wxLine/wxState/wxStamp는 app.js).

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

var SPEND_CATS = ["식비", "교통", "쇼핑", "관광", "기타"];

function spendList(st) {
  var v = st.get("spend", []);
  return Array.isArray(v) ? v : [];
}
function spendFx(st) {
  var n = Number(st.get("fx", 900));
  return isFinite(n) && n > 0 ? n : 0;
}
function spendTotalJpy(list) {
  return list.reduce(function (s, e) {
    var n = Number(e.jpy);
    return s + (isFinite(n) ? n : 0);
  }, 0);
}
function jpyToKrw(jpy, fx) {
  return Math.round(jpy * fx / 100);
}
function spendByCat(list) {
  var m = {};
  list.forEach(function (e) {
    var n = Number(e.jpy);
    m[e.cat] = (m[e.cat] || 0) + (isFinite(n) ? n : 0);
  });
  return SPEND_CATS.filter(function (c) { return m[c]; })
    .map(function (c) { return { cat: c, jpy: m[c] }; });
}
function spendByDate(list) {
  var m = {}, dates = [];
  list.forEach(function (e) {
    if (!m[e.date]) { m[e.date] = []; dates.push(e.date); }
    m[e.date].push(e);
  });
  dates.sort().reverse();
  return dates.map(function (d) {
    return { date: d, items: m[d].slice().reverse() };
  });
}

// 일차 번호(n)가 아니라 날짜로 키를 잡는다 — resyncDays가 날짜를 기준으로 일차를
// 보존하면서 n을 1부터 다시 매기기 때문에, n으로 키를 잡으면 시작일을 하루만 앞당겨도
// 메모가 통째로 밀려 엉뚱한 날에 붙거나 화면에서 사라진다(store.js의 migrateMealKeys 참고).
// 날짜는 문자열이므로 속성 컨텍스트에 넣을 때 반드시 escHtml을 거쳐야 한다.
function mealKey(date, i) { return "meal:" + String(date) + ":" + i; }

// ---- 상단 요약 ----

// lead가 true면(다른 요약 텍스트 뒤가 아니라 줄의 맨 앞이면) "· " 구분자를 붙이지 않는다.
function summarySpend(st, lead) {
  const tot = spendTotalJpy(spendList(st));
  if (!tot) return '';
  const fx = spendFx(st);
  const krw = fx ? ' (약 ' + jpyToKrw(tot, fx).toLocaleString('ko-KR') + '원)' : '';
  // lead면 줄의 맨 앞이므로 선행 공백도 붙이지 않는다 — 붙이면 .cost가 공백으로 시작한다.
  const dot = lead ? '' : '· ';
  const gap = lead ? '' : ' ';
  return gap + '<span class="spent">' + dot + '💸 현지 ¥' + tot.toLocaleString('ko-KR') + krw + '</span>';
}

function renderSummary(trip, st) {
  const today = todayLocal();
  const el = document.getElementById("summary");
  const nights = daysBetween(trip.start, trip.end) - 1;
  el.innerHTML =
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
      var line = wxLine(wxState.map, todayLocal());
      return line ? '<div class="wx">' + line.replace(" ", " 오늘 ") + wxStamp() + '</div>' : '';
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
  const meals = (day.meals && day.meals.length)
    ? '<div class="meals"><div class="meals-h">🍽 뭐먹지</div>' +
      day.meals.map(function (m, i) {
        const key = mealKey(day.date, i);
        const val = escHtml(st.get(key, ""));
        return '<div class="meal"><div class="meal-note">' + itemLinesHtml(m) + '</div>' +
          '<input class="memo" data-key="' + escHtml(key) +
          '" placeholder="식당/메모 입력" value="' + val + '"></div>';
      }).join('') + '</div>'
    : '';
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + Number(day.n) + '일차</span> ' +
      '<span class="ddate">' + escHtml(day.date) + '(' + dowOf(day.date) + ')</span>' +
      '<div class="dtheme">' + escHtml(day.theme).replace(/\n/g, ' · ') + '</div>' +
      (function () {
        var line = wxLine(wxState.map, day.date);
        return line ? '<div class="dwx">' + line + wxStamp() + '</div>' : '';
      })() + '</div>' +
      '<div class="slots">' + rows + '</div>' +
      (EDIT_MODE
        ? '<form class="item-add">' +
          '<input class="ia-time" type="time" step="300" required aria-label="시간">' +
          '<textarea class="ia-text" rows="2" placeholder="일정 내용" required ' +
            'aria-label="일정 내용"></textarea>' +
          '<button type="submit">일정 추가</button></form>'
        : '') +
      meals + '</div>';
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
    if (!secs.length) {
      // 섹션 편집기는 2단계다 — 지금 할 수 있는 게 없으므로 없는 기능을 가리키지 않는다.
      return '<p class="empty">시간표·메모처럼 직접 만드는 항목이 여기 표시됩니다.</p>';
    }
    return secs.map(function (sec, i) {
      return '<details' + (i === 0 ? ' open' : '') + '>' +
        '<summary>' + escHtml(sec.icon) + ' ' + escHtml(sec.title) + '</summary>' +
        '<div class="acc">' + sectionBodyHtml(trip, sec) + '</div></details>';
    }).join('');
  }
  return '';
}

function renderPanel(trip, st, tab) {
  var el = document.getElementById("tab-panel");
  if (!el) return;
  el.innerHTML = panelHtml(trip, tab);
  if (tab === "packing") renderPacking(trip, st);
  if (tab === "money") renderSpend(trip, st);
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


function renderSpend(trip, st) {
  const body = document.getElementById("spend-body");
  if (!body) return;
  const list = spendList(st);
  const fx = spendFx(st);
  const tot = spendTotalJpy(list);
  const krw = fx
    ? ' <span class="skrw">(약 ' + jpyToKrw(tot, fx).toLocaleString('ko-KR') + '원)</span>'
    : '';
  const chips = spendByCat(list).map(function (c) {
    return '<li>' + escHtml(c.cat) + ' <b>¥' + c.jpy.toLocaleString('ko-KR') + '</b></li>';
  }).join('');
  const groups = spendByDate(list).map(function (g) {
    const rows = g.items.map(function (e) {
      const n = Number(e.jpy);
      return '<li><span class="scat">' + escHtml(e.cat) + '</span>' +
        '<span class="snote">' + escHtml(e.note || e.cat) + '</span>' +
        '<span class="sjpy">¥' + (isFinite(n) ? n : 0).toLocaleString('ko-KR') + '</span>' +
        '<button class="spend-del" type="button" data-id="' + escHtml(e.id) +
        '" aria-label="삭제">×</button></li>';
    }).join('');
    return '<div class="sgroup"><div class="sdate">' + escHtml(g.date) + '</div>' +
      '<ul class="slist">' + rows + '</ul></div>';
  }).join('');
  body.innerHTML =
    '<div class="stotal">¥' + tot.toLocaleString('ko-KR') + krw + '</div>' +
    (chips ? '<ul class="scats">' + chips + '</ul>' : '') +
    '<form class="spend-add">' +
      '<input class="sjpy-in" type="number" inputmode="numeric" min="1" step="1" ' +
        'placeholder="금액 ¥" aria-label="금액(엔)">' +
      '<input class="snote-in" type="text" placeholder="내용" aria-label="내용">' +
      '<select class="scat-in" aria-label="분류">' +
        SPEND_CATS.map(function (c) { return '<option>' + escHtml(c) + '</option>'; }).join('') +
      '</select>' +
      '<button type="submit">추가</button>' +
    '</form>' +
    (groups || '<div class="sempty">아직 기록이 없습니다.</div>') +
    '<div class="sfx">100엔 = <input class="sfx-in" type="number" min="0" step="1" value="' +
      fx + '"> 원</div>';

  const form = body.querySelector('.spend-add');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const jin = form.querySelector('.sjpy-in');
    const jpy = Math.round(Number(jin.value));
    if (!isFinite(jpy) || jpy <= 0) { jin.focus(); return; }
    const cur = spendList(st);
    let id = Date.now();
    while (cur.some(function (x) { return x.id === id; })) id++;
    cur.push({
      id: id,
      date: todayLocal(),
      jpy: jpy,
      cat: form.querySelector('.scat-in').value,
      note: form.querySelector('.snote-in').value.trim()
    });
    st.set("spend", cur);
    renderSpend(trip, st);
    renderSummary(trip, st);
    const next = body.querySelector('.sjpy-in');
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

  const fxin = body.querySelector('.sfx-in');
  fxin.addEventListener('change', function () {
    st.set("fx", Number(fxin.value) || 0);
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
