var store = {
  _p: "osaka-trip:v1:",
  get: function (k, fb) {
    try { var v = localStorage.getItem(this._p + k); return v === null ? fb : JSON.parse(v); }
    catch (e) { return fb; }
  },
  set: function (k, v) {
    try { localStorage.setItem(this._p + k, JSON.stringify(v)); } catch (e) {}
  }
};
function mealKey(dayN, i) { return "meal:" + dayN + ":" + i; }

function dday(todayISO, startISO, endISO) {
  const day = 86400000;
  const t = Date.parse(todayISO + "T00:00:00");
  const s = Date.parse(startISO + "T00:00:00");
  const e = Date.parse(endISO + "T00:00:00");
  if (t < s) return "D-" + Math.round((s - t) / day);
  if (t > e) return "여행 종료";
  return "여행 중 " + (Math.round((t - s) / day) + 1) + "일차";
}

function renderSummary(meta) {
  const today = new Date().toISOString().slice(0, 10);
  const el = document.getElementById("summary");
  el.innerHTML =
    '<div class="dday">' + dday(today, meta.start, meta.end) + '</div>' +
    '<h1>' + meta.title + '</h1>' +
    '<div class="period">' + meta.start + ' ~ ' + meta.end +
      ' · ' + meta.nights + '박 ' + meta.days + '일</div>' +
    '<div class="hotel">🏨 ' + meta.hotel + '</div>' +
    '<div class="cost">💰 총 ' + meta.totalCostKRW.toLocaleString('ko-KR') + '원 (2인)</div>';
}
function isUndecided(text) {
  return /뭐먹지|\?$/.test(text.trim()) || text.trim() === "";
}

function renderTabs(days, selectedN) {
  const nav = document.getElementById("daytabs");
  nav.innerHTML = days.map(function (d) {
    const on = d.n === selectedN ? ' data-selected="1"' : '';
    return '<button class="tab"' + on + ' data-n="' + d.n + '">' +
      '<span class="tn">' + d.n + '일차</span>' +
      '<span class="td">' + d.date.slice(5) + '(' + d.dow + ')</span></button>';
  }).join('');
  nav.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { selectDay(parseInt(b.dataset.n, 10)); });
  });
}

function usjMapSVG() {
  var route = [
    { t: "슈퍼 닌텐도 월드", c: "#e03131" },
    { t: "해리포터", c: "#7048e8" },
    { t: "쥬라기 공원", c: "#2f9e44" },
    { t: "워터 월드", c: "#1c7ed6" },
    { t: "애머티 (죠스)", c: "#7950f2" },
    { t: "미니언 파크", c: "#f08c00" },
    { t: "할리우드 · 입구", c: "#c2255c" },
    { t: "시티워크 (저녁)", c: "#e8590c" }
  ];
  var chips = route.map(function (z) {
    return '<li><i style="background:' + z.c + '"></i>' + z.t + '</li>';
  }).join('');
  var src = window.USJ_MAP_SRC || 'usj-map-ko.webp';
  return '<div class="usjmap"><div class="cap">🗺️ 유니버셜 스튜디오 재팬 구역 안내도 ' +
    '<span>(아래 목록 = 2일차 동선)</span></div>' +
    '<img src="' + src + '" alt="유니버셜 스튜디오 재팬 한국어 구역 안내도" loading="lazy">' +
    '<ul class="zonelegend">' + chips + '</ul></div>';
}

function renderTimeline(day) {
  const main = document.getElementById("timeline");
  const rows = day.items.map(function (it) {
    const cls = isUndecided(it.text) ? ' undecided' : '';
    const lines = it.text.split('\n').map(function (l) {
      if (/\(패스권-시간\)|\(시간\)/.test(l)) {
        return '<div class="line timed"><span class="tag">⏰ 시간지정</span>' + l + '</div>';
      }
      if (/예약 완료/.test(l)) {
        return '<div class="line booked"><span class="tag">✅ 예약완료</span>' + l + '</div>';
      }
      return '<div class="line">' + l + '</div>';
    }).join('');
    return '<div class="slot' + cls + '"><div class="time">' + it.time +
      '</div><div class="what">' + lines + '</div></div>';
  }).join('');
  const escAttr = function (s) { return String(s).replace(/"/g, '&quot;'); };
  const meals = (day.meals && day.meals.length)
    ? '<div class="meals"><div class="meals-h">🍽 뭐먹지</div>' +
      day.meals.map(function (m, i) {
        const lines = m.split('\n').map(function (l) {
          return '<div class="line">' + l + '</div>';
        }).join('');
        const val = escAttr(store.get(mealKey(day.n, i), ""));
        return '<div class="meal"><div class="meal-note">' + lines + '</div>' +
          '<input class="memo" data-key="' + mealKey(day.n, i) +
          '" placeholder="식당/메모 입력" value="' + val + '"></div>';
      }).join('') + '</div>'
    : '';
  const map = day.n === 2 ? usjMapSVG() : '';
  main.innerHTML =
    '<div class="daycard"><div class="dayhead">' +
      '<span class="dnum">' + day.n + '일차</span> ' +
      '<span class="ddate">' + day.date + '(' + day.dow + ')</span>' +
      '<div class="dtheme">' + day.theme.replace(/\n/g, ' · ') + '</div></div>' +
      map +
      '<div class="slots">' + rows + '</div>' + meals + '</div>';
  main.querySelectorAll('.memo').forEach(function (inp) {
    inp.addEventListener('input', function () { store.set(inp.dataset.key, inp.value); });
  });
}
function selectDay(n) {
  const days = window.TRIP.days;
  const day = days.find(function (d) { return d.n === n; });
  renderTabs(days, n);
  renderTimeline(day);
}

function renderFixed(trip) {
  const rapitRows = function (arr) {
    return arr.map(function (r) {
      return '<tr><td>' + r.type + '</td><td>' + r.dep + '</td><td>' + r.arr + '</td></tr>';
    }).join('');
  };
  const expRows = trip.expenses.map(function (e) {
    return '<tr><td>' + e.cat + '</td><td>' + e.detail + '</td>' +
      '<td class="num">' + e.krw.toLocaleString('ko-KR') + '</td></tr>';
  }).join('');
  const tips = trip.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('');
  document.getElementById("fixed").innerHTML =
    '<details open><summary>🚄 라피트 시간표</summary><div class="acc">' +
      '<div class="tblwrap"><table><caption>간사이 → 난바</caption>' +
      '<thead><tr><th>편</th><th>출발</th><th>도착</th></tr></thead><tbody>' +
      rapitRows(trip.rapit.to) + '</tbody></table></div>' +
      '<div class="tblwrap"><table><caption>난바 → 간사이</caption>' +
      '<thead><tr><th>편</th><th>출발</th><th>도착</th></tr></thead><tbody>' +
      rapitRows(trip.rapit.from) + '</tbody></table></div></div></details>' +
    '<details><summary>🏨 숙소</summary><div class="acc">' + trip.meta.hotel + '</div></details>' +
    '<details><summary>🎒 준비물</summary><div class="acc" id="packing-body"></div></details>' +
    '<details><summary>💰 경비 내역</summary><div class="acc"><div class="tblwrap"><table>' +
      '<thead><tr><th>항목</th><th>상세</th><th class="num">금액(원)</th></tr></thead><tbody>' +
      expRows + '</tbody><tfoot><tr><td colspan="2">합계</td><td class="num">' +
      trip.meta.totalCostKRW.toLocaleString('ko-KR') + '</td></tr></tfoot>' +
      '</table></div></div></details>' +
    '<details><summary>💡 팁</summary><div class="acc"><ul>' + tips + '</ul></div></details>';
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderPacking() {
  const body = document.getElementById("packing-body");
  if (!body) return;
  const customs = store.get("packing_add", []);
  const checked = store.get("packing_checked", {});
  const items = window.TRIP.packing.map(function (t) { return { text: t, custom: false }; })
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
      const c = store.get("packing_checked", {});
      c[cb.dataset.text] = cb.checked;
      store.set("packing_checked", c);
      cb.closest('li').classList.toggle('done', cb.checked);
    });
  });
  body.querySelectorAll('.pack-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const list = store.get("packing_add", []).filter(function (t) { return t !== btn.dataset.text; });
      store.set("packing_add", list);
      renderPacking();
    });
  });
  const form = body.querySelector('.pack-add');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const inp = form.querySelector('input');
    const v = inp.value.trim();
    if (!v) return;
    const list = store.get("packing_add", []);
    if (list.indexOf(v) === -1 && window.TRIP.packing.indexOf(v) === -1) {
      list.push(v);
      store.set("packing_add", list);
    }
    renderPacking();
    const nextInput = body.querySelector('.pack-add input');
    if (nextInput) nextInput.focus();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderSummary(window.TRIP.meta);

  const days = window.TRIP.days;
  const today = new Date().toISOString().slice(0, 10);
  let initial = days.find(function (d) { return d.date === today; });
  if (!initial) initial = today < days[0].date ? days[0] : days[days.length - 1];
  selectDay(initial.n);

  renderFixed(window.TRIP);
  renderPacking();
});
