// 렌더 계층: DOM에 그리는 함수만 모은다.
// trip(여행 본체)과 st(tripStore)를 인자로 받는다 — 전역 여행/저장소를 읽지 않는다.
// schema.js 다음, app.js 앞에 로드된다 (dowOf/daysBetween 사용, wxLine/wxState/wxStamp는 app.js).

// 사용자가 입력한 문자열이 HTML로 해석되지 않게 막는다.
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function isUndecided(text) {
  return /뭐먹지|\?$/.test(text.trim()) || text.trim() === "";
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

function mealKey(dayN, i) { return "meal:" + dayN + ":" + i; }

// ---- 상단 요약 ----

function summarySpend(st) {
  const tot = spendTotalJpy(spendList(st));
  if (!tot) return '';
  const fx = spendFx(st);
  const krw = fx ? ' (약 ' + jpyToKrw(tot, fx).toLocaleString('ko-KR') + '원)' : '';
  return ' <span class="spent">· 💸 현지 ¥' + tot.toLocaleString('ko-KR') + krw + '</span>';
}

function renderSummary(trip, st) {
  const today = todayLocal();
  const el = document.getElementById("summary");
  const nights = daysBetween(trip.start, trip.end) - 1;
  el.innerHTML =
    '<div class="dday">' + dday(today, trip.start, trip.end) + '</div>' +
    '<h1>' + escHtml(trip.title) + '</h1>' +
    '<div class="period">' + escHtml(trip.start) + ' ~ ' + escHtml(trip.end) +
      ' · ' + nights + '박 ' + (nights + 1) + '일</div>' +
    (trip.hotel ? '<div class="hotel">🏨 ' + escHtml(trip.hotel) + '</div>' : '') +
    (function () {
      var line = wxLine(wxState.map, todayLocal());
      return line ? '<div class="wx">' + line.replace(" ", " 오늘 ") + wxStamp() + '</div>' : '';
    })() +
    (trip.budgetKRW
      ? '<div class="cost">💰 총 ' + trip.budgetKRW.toLocaleString('ko-KR') + '원 (' +
        trip.party + '인)' + summarySpend(st) + '</div>'
      : '');
}

// ---- 일차 탭 / 타임라인 ----

function renderTabs(trip, selectedN, onSelect) {
  const nav = document.getElementById("daytabs");
  nav.innerHTML = trip.days.map(function (d) {
    const on = d.n === selectedN ? ' data-selected="1"' : '';
    return '<button class="tab"' + on + ' data-n="' + d.n + '">' +
      '<span class="tn">' + d.n + '일차</span>' +
      '<span class="td">' + escHtml(d.date.slice(5)) + '(' + dowOf(d.date) + ')</span></button>';
  }).join('');
  nav.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { onSelect(parseInt(b.dataset.n, 10)); });
  });
  // 탭이 많은 여행(30일)에서 현재 일차가 화면 밖에 있는 것을 막는다.
  const sel = nav.querySelector('.tab[data-selected]');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ inline: "center", block: "nearest" });
}

function renderTimeline(trip, day, st) {
  const main = document.getElementById("timeline");
  const rows = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    return '<div class="slot' + cls + '" data-item="' + escHtml(it.id) + '">' +
      '<div class="time">' + escHtml(it.time) + '</div>' +
      '<div class="what">' + itemLinesHtml(it.text) + '</div></div>';
  }).join('');
  const meals = (day.meals && day.meals.length)
    ? '<div class="meals"><div class="meals-h">🍽 뭐먹지</div>' +
      day.meals.map(function (m, i) {
        const val = escHtml(st.get(mealKey(day.n, i), ""));
        return '<div class="meal"><div class="meal-note">' + itemLinesHtml(m) + '</div>' +
          '<input class="memo" data-key="' + mealKey(day.n, i) +
          '" placeholder="식당/메모 입력" value="' + val + '"></div>';
      }).join('') + '</div>'
    : '';
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + day.n + '일차</span> ' +
      '<span class="ddate">' + escHtml(day.date) + '(' + dowOf(day.date) + ')</span>' +
      '<div class="dtheme">' + escHtml(day.theme).replace(/\n/g, ' · ') + '</div>' +
      (function () {
        var line = wxLine(wxState.map, day.date);
        return line ? '<div class="dwx">' + line + wxStamp() + '</div>' : '';
      })() + '</div>' +
      '<div class="slots">' + rows + '</div>' + meals + '</div>';
  main.querySelectorAll('.memo').forEach(function (inp) {
    inp.addEventListener('input', function () { st.set(inp.dataset.key, inp.value); });
  });
}

// ---- 하단 고정 섹션 ----

function sectionBodyHtml(trip, sec) {
  if (sec.type === "builtin") {
    if (sec.body === "hotel")    return escHtml(trip.hotel);
    if (sec.body === "packing")  return '<div id="packing-body"></div>';
    if (sec.body === "spend")    return '<div id="spend-body"></div>';
    if (sec.body === "expenses") return expensesTableHtml(trip);
    return '';
  }
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

function renderFixed(trip, st) {
  document.getElementById("fixed").innerHTML = trip.sections.map(function (sec, i) {
    return '<details' + (i === 0 ? ' open' : '') + '>' +
      '<summary>' + escHtml(sec.icon) + ' ' + escHtml(sec.title) + '</summary>' +
      '<div class="acc">' + sectionBodyHtml(trip, sec) + '</div></details>';
  }).join('');
  renderPacking(trip, st);
  renderSpend(trip, st);
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
