// 브라우저(test.html)와 Node(test-node.js) 양쪽에서 로드된다.
// 러너가 전역 eq(name, got, want)를 미리 정의해 둔다. 여기서는 단언만 쓴다.

var L = [
  { id: 1, date: "2026-07-29", jpy: 1200, cat: "식비", note: "이치란" },
  { id: 2, date: "2026-07-29", jpy: 800,  cat: "교통", note: "지하철" },
  { id: 3, date: "2026-07-30", jpy: 2000, cat: "식비", note: "저녁" },
  { id: 4, date: "2026-07-28", jpy: 500,  cat: "기타", note: "" }
];

eq('합계', spendTotalJpy(L), 4500);
eq('빈 목록 합계', spendTotalJpy([]), 0);
eq('잘못된 금액은 0으로', spendTotalJpy([{jpy:"abc"},{jpy:100}]), 100);

eq('환산 900', jpyToKrw(4500, 900), 40500);
eq('환산 반올림', jpyToKrw(1234, 900), 11106);
eq('환율 0이면 0', jpyToKrw(4500, 0), 0);

eq('분류별 집계', spendByCat(L), [
  { cat: "식비", jpy: 3200 },
  { cat: "교통", jpy: 800 },
  { cat: "기타", jpy: 500 }
]);
eq('빈 목록 분류', spendByCat([]), []);

eq('날짜별 그룹', spendByDate(L).map(function (g) {
  return { date: g.date, ids: g.items.map(function (e) { return e.id; }) };
}), [
  { date: "2026-07-30", ids: [3] },
  { date: "2026-07-29", ids: [2, 1] },
  { date: "2026-07-28", ids: [4] }
]);

eq('분류 목록', SPEND_CATS, ["식비", "교통", "쇼핑", "관광", "기타"]);

eq('wxIcon 맑음', wxIcon(0), { e: "☀️", t: "맑음" });
eq('wxIcon 구름', wxIcon(2), { e: "🌤️", t: "구름 조금" });
eq('wxIcon 흐림', wxIcon(3), { e: "☁️", t: "흐림" });
eq('wxIcon 이슬비', wxIcon(55), { e: "🌦️", t: "이슬비" });
eq('wxIcon 비', wxIcon(63), { e: "🌧️", t: "비" });
eq('wxIcon 소나기', wxIcon(81), { e: "🌧️", t: "소나기" });
eq('wxIcon 뇌우', wxIcon(96), { e: "⛈️", t: "뇌우" });
eq('wxIcon 미지 코드', wxIcon(42), { e: "🌡️", t: "" });

var WXAPI = { daily: {
  time: ["2026-07-28", "2026-07-29"],
  weather_code: [1, 61],
  temperature_2m_max: [33.4, 29.6],
  temperature_2m_min: [26.2, 25.5],
  precipitation_probability_max: [10, null]
} };
eq('wxDailyMap 변환', wxDailyMap(WXAPI)["2026-07-28"],
  { code: 1, tmax: 33, tmin: 26, rain: 10 });
eq('wxDailyMap null api', wxDailyMap(null), {});
eq('wxLine 포맷', wxLine(wxDailyMap(WXAPI), "2026-07-28"), "🌤️ 33° / 26° · 비 10%");
eq('wxLine 강수 null 생략', wxLine(wxDailyMap(WXAPI), "2026-07-29"), "🌧️ 30° / 26°");
eq('wxLine 없는 날짜', wxLine(wxDailyMap(WXAPI), "2026-08-09"), "");

// ---- store.js ----
__resetStorage();

eq('lsGet 기본값', lsGet('없는키', 42), 42);
lsSet('k', { a: 1 });
eq('lsSet/lsGet 왕복', lsGet('k', null), { a: 1 });
lsDel('k');
eq('lsDel 후 기본값', lsGet('k', 'gone'), 'gone');

eq('tripKey 조합', tripKey('t_1', 'spend'), 'trip:t_1:spend');
eq('newTripId 접두사', newTripId().slice(0, 2), 't_');
eq('newTripId 유일', newTripId() === newTripId(), false);

eq('빈 여행 목록', listTrips(), []);

var T1 = { schema: 1, id: 't_a', title: '오사카', start: '2026-07-28', end: '2026-08-03', days: [] };
saveTrip(T1);
eq('저장 후 목록', listTrips(),
  [{ id: 't_a', title: '오사카', start: '2026-07-28', end: '2026-08-03' }]);
eq('불러오기', loadTrip('t_a').title, '오사카');
eq('없는 여행', loadTrip('t_zzz'), null);

T1.title = '오사카 재방문';
saveTrip(T1);
eq('같은 id 재저장은 중복 안 만듦', listTrips().length, 1);
eq('인덱스 제목 갱신', listTrips()[0].title, '오사카 재방문');

var st = tripStore('t_a');
st.set('spend', [{ id: 1, jpy: 100 }]);
eq('여행별 저장소', st.get('spend', []), [{ id: 1, jpy: 100 }]);
eq('여행별 저장소는 raw 키를 쓴다', lsGet('trip:t_a:spend', null), [{ id: 1, jpy: 100 }]);
eq('다른 여행과 격리', tripStore('t_b').get('spend', []), []);

deleteTrip('t_a');
eq('삭제 후 목록', listTrips(), []);
eq('삭제 후 본체', loadTrip('t_a'), null);
eq('삭제 후 런타임 키도 제거', lsGet('trip:t_a:spend', 'gone'), 'gone');

// ---- schema.js ----
eq('요일 파생', dowOf('2026-07-28'), '화');
eq('요일 일요일', dowOf('2026-08-02'), '일');
eq('날짜 더하기', addDays('2026-07-28', 3), '2026-07-31');
eq('월 넘김', addDays('2026-07-30', 5), '2026-08-04');
eq('기간 일수', daysBetween('2026-07-28', '2026-08-03'), 7);
eq('같은 날 하루', daysBetween('2026-07-28', '2026-07-28'), 1);

var D = buildDays('2026-07-28', '2026-07-30');
eq('일차 개수', D.length, 3);
eq('일차 번호와 날짜', D.map(function (d) { return d.n + ':' + d.date; }),
  ['1:2026-07-28', '2:2026-07-29', '3:2026-07-30']);
eq('빈 일차 형태', D[0],
  { n: 1, date: '2026-07-28', theme: '', place: null, curCode: null,
    items: [], meals: [], images: [] });

// 재동기화: 앞을 하루 자르고 뒤를 하루 늘려도 남는 날짜의 일정은 보존된다
D[1].items.push({ id: 'i_x', time: '09:00', text: '유니버셜' });
D[1].theme = '테마파크';
var R = resyncDays(D, '2026-07-29', '2026-07-31');
eq('재동기화 개수', R.length, 3);
eq('재동기화 번호 재부여', R.map(function (d) { return d.n + ':' + d.date; }),
  ['1:2026-07-29', '2:2026-07-30', '3:2026-07-31']);
eq('남은 날짜의 일정 보존', R[0].items, [{ id: 'i_x', time: '09:00', text: '유니버셜' }]);
eq('남은 날짜의 테마 보존', R[0].theme, '테마파크');
eq('새로 생긴 날짜는 비어 있음', R[2].items, []);

eq('내장 섹션 4개', defaultSections().map(function (s) { return s.body; }),
  ['hotel', 'packing', 'spend', 'expenses']);
eq('내장 섹션 타입', defaultSections()[0].type, 'builtin');

var NT = emptyTrip({ title: '방콕', start: '2026-09-01', end: '2026-09-04' });
eq('새 여행 스키마 버전', NT.schema, 1);
eq('새 여행 일차 수', NT.days.length, 4);
eq('새 여행 기본 인원', NT.party, 2);
eq('새 여행 기본 통화', NT.currency, { code: 'KRW', symbol: '₩', decimals: 0, unit: 1 });
eq('새 여행 빈 준비물', NT.packing, []);
eq('새 여행 id 접두사', NT.id.slice(0, 2), 't_');

// 상속 헬퍼
var TP = { place: { name: '파리' }, currency: { code: 'EUR' } };
eq('일차 장소 상속', dayPlace(TP, { place: null }), { name: '파리' });
eq('일차 장소 오버라이드', dayPlace(TP, { place: { name: '로마' } }), { name: '로마' });
eq('일차 통화 상속', dayCurrency(TP, { curCode: null }).code, 'EUR');
eq('일차 통화 오버라이드', dayCurrency(TP, { curCode: 'CHF' }).code, 'CHF');

// ---- 마이그레이션 ----
__resetStorage();
eq('구 데이터 없으면 null', migrateLegacy(), null);

__resetStorage();
lsSet('osaka-trip:v1:spend', [{ id: 1, date: '2026-07-29', jpy: 1200, cat: '식비', note: '이치란' }]);
lsSet('osaka-trip:v1:fx', 920);
lsSet('osaka-trip:v1:packing_checked', { '여권 + 사본': true });
lsSet('osaka-trip:v1:packing_add', ['멀미약']);
lsSet('osaka-trip:v1:meal:2:0', '구시카츠 다루마');
lsSet('osaka-trip:v1:weather', { fetchedAt: '2026-07-27', daily: {} });

var mid = migrateLegacy();
eq('이관 후 여행 id 반환', typeof mid, 'string');
eq('이관된 여행이 목록에 있음', listTrips().length, 1);
eq('이관된 여행 제목', loadTrip(mid).title, '오사카 여행');
eq('경비 이관', tripStore(mid).get('spend', []),
  [{ id: 1, date: '2026-07-29', jpy: 1200, cat: '식비', note: '이치란' }]);
eq('환율 이관', tripStore(mid).get('fx', 0), 920);
eq('준비물 체크 이관', tripStore(mid).get('packing_checked', {}), { '여권 + 사본': true });
eq('추가 준비물 이관', tripStore(mid).get('packing_add', []), ['멀미약']);
// 구 데이터의 meal 키는 일차 번호 기준(meal:2:0)이었다 — 이관하면서 날짜 기준으로
// 다시 잡는다. 샘플 여행의 2일차는 2026-07-29다.
eq('식사 메모는 날짜 기준 키로 이관', tripStore(mid).get('meal:2026-07-29:0', ''), '구시카츠 다루마');
eq('이관 후 구 번호 기준 키는 남지 않음', tripStore(mid).get('meal:2:0', 'none'), 'none');
eq('날씨 이관', tripStore(mid).get('weather', null), { fetchedAt: '2026-07-27', daily: {} });
eq('구 키 제거', lsGet('osaka-trip:v1:spend', 'gone'), 'gone');
eq('구 날씨 키 제거', lsGet('osaka-trip:v1:weather', 'gone'), 'gone');
eq('두 번째 호출은 null', migrateLegacy(), null);

// 쓰기가 조용히 실패하는 경우: 구 키는 그대로 남아야 하고, 반쪽짜리 새 여행은 만들어지지 않는다
__resetStorage();
lsSet('osaka-trip:v1:spend', [{ id: 1, date: '2026-07-29', jpy: 1200, cat: '식비', note: '이치란' }]);
lsSet('osaka-trip:v1:fx', 920);
__setWritesFail(true);
var midFail = migrateLegacy();
__setWritesFail(false);
eq('쓰기 실패 시 null 반환', midFail, null);
eq('쓰기 실패해도 구 spend 키 보존', lsGet('osaka-trip:v1:spend', 'gone'),
  [{ id: 1, date: '2026-07-29', jpy: 1200, cat: '식비', note: '이치란' }]);
eq('쓰기 실패해도 구 fx 키 보존', lsGet('osaka-trip:v1:fx', 'gone'), 920);
eq('쓰기 실패 시 여행 목록에 반쪽짜리 여행 없음', listTrips(), []);

// 재시도: 정상 쓰기로 돌아오면 남아있던 구 데이터가 이관된다
var midRetry = migrateLegacy();
eq('실패 후 재시도는 성공', typeof midRetry, 'string');
eq('재시도로 구 키 제거', lsGet('osaka-trip:v1:spend', 'gone'), 'gone');

__resetStorage();
var sid = installSample();
eq('샘플 설치', loadTrip(sid).title, '오사카 여행');
eq('샘플에 id 부여', loadTrip(sid).id, sid);
eq('샘플 일차 수', loadTrip(sid).days.length, 7);

// ---- views.js 순수 함수 ----
eq('escHtml 기본', escHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
eq('escHtml 숫자', escHtml(3), '3');

eq('itemLinesHtml 한 줄',
  itemLinesHtml('도톤보리 구경'),
  '<div class="line">도톤보리 구경</div>');
eq('itemLinesHtml 여러 줄',
  itemLinesHtml('a\nb'),
  '<div class="line">a</div><div class="line">b</div>');
eq('itemLinesHtml 시간지정 배지',
  itemLinesHtml('닌텐도 월드(패스권-시간)'),
  '<div class="line timed"><span class="tag">⏰ 시간지정</span>닌텐도 월드(패스권-시간)</div>');
eq('itemLinesHtml 예약 배지',
  itemLinesHtml('스키야끼 후지모토 19:30 예약 완료'),
  '<div class="line booked"><span class="tag">✅ 예약완료</span>스키야끼 후지모토 19:30 예약 완료</div>');
eq('itemLinesHtml XSS 차단',
  itemLinesHtml('<img src=x onerror=alert(1)>'),
  '<div class="line">&lt;img src=x onerror=alert(1)&gt;</div>');
eq('itemLinesHtml 배지 줄도 escape',
  itemLinesHtml('<b>(시간)</b>'),
  '<div class="line timed"><span class="tag">⏰ 시간지정</span>&lt;b&gt;(시간)&lt;/b&gt;</div>');

eq('미정 판정 뭐먹지', isUndecided('뭐먹지'), true);
eq('미정 판정 물음표', isUndecided('라멘?'), true);
eq('미정 판정 빈칸', isUndecided('  '), true);
eq('미정 아님', isUndecided('이치란 라멘'), false);

eq('D-day 이전', dday('2026-07-25', '2026-07-28', '2026-08-03'), 'D-3');
eq('D-day 당일', dday('2026-07-28', '2026-07-28', '2026-08-03'), '여행 중 1일차');
eq('D-day 중간', dday('2026-07-30', '2026-07-28', '2026-08-03'), '여행 중 3일차');
eq('D-day 이후', dday('2026-08-05', '2026-07-28', '2026-08-03'), '여행 종료');

// ---- app.js pickDay — 오늘 날짜는 세 번째 인자로 주입한다(안 그러면 테스트가 썩는다) ----
(function () {
  var trip = { days: [
    { n: 1, date: '2026-07-28' },
    { n: 2, date: '2026-07-29' },
    { n: 3, date: '2026-07-30' }
  ] };
  function n(d) { return d ? d.n : null; }

  eq('pickDay: 요청한 일차를 그대로 고름', n(pickDay(trip, 2, '2026-07-28')), 2);
  // 범위를 벗어난 dayN → 오늘 날짜와 같은 날로 물러난다
  eq('pickDay: 범위 밖 dayN이면 오늘 일차로 물러남', n(pickDay(trip, 9, '2026-07-29')), 2);
  // 일치하는 날짜도 없고 여행 시작 전이면 첫날
  eq('pickDay: 일치 없고 여행 전이면 첫날', n(pickDay(trip, 9, '2026-07-01')), 1);
  // 일치하는 날짜도 없고 여행이 끝난 뒤면 마지막날
  eq('pickDay: 일치 없고 여행 후면 마지막날', n(pickDay(trip, null, '2026-08-20')), 3);
  // days가 비었으면 던지지 않고 null
  eq('pickDay: days가 비면 null', pickDay({ days: [] }, 1, '2026-07-29'), null);
  eq('pickDay: days가 없으면 null', pickDay({}, 1, '2026-07-29'), null);
})();

// ---- 속성 컨텍스트(attribute context) 이스케이프 — 렌더 함수를 실제로 호출해
// innerHTML을 검사한다. 문자열이어야 할 자리에 악의적인 문자열이 들어와도
// (imported trip JSON을 검증하지 않으므로 가능) raw 마크업이 살아남지 않아야 한다.
(function () {
  var HOSTILE = '"><img src=x onerror=alert(1)>';
  var escHostile = escHtml(HOSTILE);

  function makeSt() {
    var mem = {};
    return {
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
      set: function (k, v) { mem[k] = v; },
      _mem: mem
    };
  }

  // renderTimeline: 악의적인 day.n(숫자여야 하는 필드), 악의적인 item.id,
  // 악의적인 meal memo 저장값(모두 value="..." / data-*="..." 속성 컨텍스트)
  (function () {
    // day.date도 악의적인 문자열로 둔다 — meal 메모 키가 일차 번호가 아니라 날짜로
    // 잡히면서(mealKey) 이 필드가 data-key 속성 컨텍스트로 직접 흘러가기 때문이다.
    var day = {
      n: HOSTILE,
      date: HOSTILE,
      theme: "",
      items: [{ id: HOSTILE, time: "09:00", text: "테스트 일정" }],
      meals: ["저녁"]
    };
    var trip = { days: [day] };
    var st = makeSt();
    st.set(mealKey(day.date, 0), HOSTILE);

    var el = global.__setDomTarget("timeline");
    renderTimeline(trip, day, st);
    var html = el.innerHTML;

    eq('renderTimeline: raw <img> 태그가 어디에도 없음', html.indexOf('<img') === -1, true);
    eq('renderTimeline: 문자열이 와야 할 data-item 속성은 이스케이프됨',
      html.indexOf('data-item="' + escHostile + '"') !== -1, true);
    eq('renderTimeline: 악의적인 meal memo 저장값은 value 속성에서 이스케이프됨',
      html.indexOf('value="' + escHostile + '"') !== -1, true);
    // meal 키는 이제 날짜(문자열) 기준이다 — 숫자 강제 변환으로는 막을 수 없으므로
    // data-key 속성에 넣을 때 escHtml을 거쳐야 한다.
    eq('renderTimeline: 날짜 기준 meal 키는 data-key 속성에서 이스케이프됨',
      html.indexOf('data-key="meal:' + escHostile + ':0"') !== -1, true);
    // day.n은 숫자 필드 — 문자열이 들어오면 이스케이프 대신 숫자로 강제 변환한다.
    eq('renderTimeline: 숫자 필드 day.n은 표시 라벨에서 NaN으로 강제 변환됨',
      html.indexOf('<span class="dnum">NaN일차</span>') !== -1, true);
  })();

  // renderTabs: 악의적인 d.n(숫자여야 하는 필드) — data-n 속성과 탭 라벨 양쪽.
  (function () {
    var trip = { days: [
      { n: HOSTILE, date: "2026-07-28" },
      { n: 2, date: "2026-07-29" }
    ] };
    var el = global.__setDomTarget("daytabs");
    renderTabs(trip, 2, function () {});
    var html = el.innerHTML;

    eq('renderTabs: raw <img> 태그가 어디에도 없음', html.indexOf('<img') === -1, true);
    eq('renderTabs: 숫자 필드 d.n은 data-n 속성에서 NaN으로 강제 변환됨',
      html.indexOf('data-n="NaN"') !== -1, true);
    eq('renderTabs: 숫자 필드 d.n은 탭 라벨에서도 NaN으로 강제 변환됨',
      html.indexOf('<span class="tn">NaN일차</span>') !== -1, true);
  })();

  // renderSummary: 악의적인 budgetKRW/party(숫자여야 하는 필드).
  (function () {
    var trip = {
      title: "테스트 여행", start: "2026-07-28", end: "2026-08-03",
      hotel: "", budgetKRW: HOSTILE, party: HOSTILE
    };
    var st = makeSt();
    var el = global.__setDomTarget("summary");
    renderSummary(trip, st);
    var html = el.innerHTML;

    eq('renderSummary: raw <img> 태그가 어디에도 없음', html.indexOf('<img') === -1, true);
    eq('renderSummary: budgetKRW/party 문자열은 숫자로 강제 변환되어 안전함',
      html.indexOf('NaN원 (NaN인)') !== -1, true);
  })();

  // renderSummary: 💰 예산 줄과 💸 현지 경비 합계 줄은 서로 독립이어야 한다.
  // budgetKRW는 생성/설정 폼에 입력란이 없어 기본값 0으로 남는 여행이 대부분이므로,
  // 예산이 없어도 기록된 경비 합계는 반드시 보여야 한다(원래 결함).
  (function () {
    function makeTrip(budgetKRW) {
      return {
        title: "테스트 여행", start: "2026-07-28", end: "2026-08-03",
        hotel: "", party: 2, budgetKRW: budgetKRW
      };
    }
    function costDiv(html) {
      var m = html.match(/<div class="cost">([\s\S]*?)<\/div>/);
      return m ? m[1] : null;
    }

    // budgetKRW=0, 경비 있음 → 현지 경비 줄만, 선행 구분자(·) 없이.
    (function () {
      var trip = makeTrip(0);
      var st = makeSt();
      st.set("spend", [{ id: 1, date: "2026-07-29", jpy: 1000, cat: "식비", note: "" }]);
      var el = global.__setDomTarget("summary");
      renderSummary(trip, st);
      var html = el.innerHTML;
      var cost = costDiv(html);

      eq('renderSummary: 예산 0·경비 있음 → .cost 존재', cost !== null, true);
      eq('renderSummary: 예산 0·경비 있음 → 💸 현지 줄 표시', cost.indexOf('💸 현지') !== -1, true);
      eq('renderSummary: 예산 0·경비 있음 → 💰 총 줄은 없음', cost.indexOf('💰 총') === -1, true);
      eq('renderSummary: 예산 0·경비 있음 → 선행 구분자(·) 없음', cost.indexOf('· 💸') === -1, true);
      // 줄의 맨 앞이므로 선행 공백도 없어야 한다(summarySpend의 lead 인자).
      eq('renderSummary: 예산 0·경비 있음 → 선행 공백 없음', cost.charAt(0) === ' ', false);
    })();

    // budgetKRW>0, 경비 있음 → 두 줄 다, 구분자(·)로 이어짐.
    (function () {
      var trip = makeTrip(500000);
      var st = makeSt();
      st.set("spend", [{ id: 1, date: "2026-07-29", jpy: 1000, cat: "식비", note: "" }]);
      var el = global.__setDomTarget("summary");
      renderSummary(trip, st);
      var html = el.innerHTML;
      var cost = costDiv(html);

      eq('renderSummary: 예산·경비 모두 있음 → 💰 총 줄 표시', cost.indexOf('💰 총') !== -1, true);
      eq('renderSummary: 예산·경비 모두 있음 → 💸 현지 줄 표시', cost.indexOf('💸 현지') !== -1, true);
      eq('renderSummary: 예산·경비 모두 있음 → 구분자(· 💸)로 연결됨',
        cost.indexOf('· 💸') !== -1, true);
    })();

    // budgetKRW=0, 경비 없음 → .cost 자체가 없어야 함(빈 div/떠 있는 구분자 금지).
    (function () {
      var trip = makeTrip(0);
      var st = makeSt();
      var el = global.__setDomTarget("summary");
      renderSummary(trip, st);
      var html = el.innerHTML;

      eq('renderSummary: 예산·경비 모두 없음 → .cost 없음', html.indexOf('class="cost"') === -1, true);
    })();
  })();
})();

// ---- editor.js 순수 로직 ----
eq('폼 검증 통과',
  validateTripForm({ title: '방콕', start: '2026-09-01', end: '2026-09-04', party: 2 }), null);
eq('제목 없음',
  validateTripForm({ title: '  ', start: '2026-09-01', end: '2026-09-04', party: 2 }),
  '여행 제목을 입력하세요.');
eq('날짜 없음',
  validateTripForm({ title: '방콕', start: '', end: '2026-09-04', party: 2 }),
  '시작일과 종료일을 입력하세요.');
eq('종료가 시작보다 빠름',
  validateTripForm({ title: '방콕', start: '2026-09-05', end: '2026-09-04', party: 2 }),
  '종료일이 시작일보다 빠릅니다.');
eq('너무 긴 여행',
  validateTripForm({ title: '세계일주', start: '2026-01-01', end: '2027-01-01', party: 2 }),
  '여행 기간은 최대 90일입니다.');
eq('인원 0',
  validateTripForm({ title: '방콕', start: '2026-09-01', end: '2026-09-04', party: 0 }),
  '인원은 1명 이상이어야 합니다.');

var made = applyTripForm(null,
  { title: '방콕', start: '2026-09-01', end: '2026-09-04', party: 3, hotel: '아속' });
eq('새 여행 제목', made.title, '방콕');
eq('새 여행 일차', made.days.length, 4);
eq('새 여행 인원', made.party, 3);
eq('새 여행 숙소', made.hotel, '아속');

// applyTripForm(trip, f)는 trip을 그 자리에서 고쳐 동일 객체를 돌려준다(새로 만들지
// 않는다). edited와 made를 서로 비교하는 건 항상 참인 동어반복이므로(같은 객체이니
// 당연히 id도 같다) 호출 전에 따로 값을 떠 둔 madeId와 비교해야 실제로 실패할 수 있다.
var madeId = made.id;
made.days[1].items.push({ id: 'i_k', time: '10:00', text: '왕궁' });
var edited = applyTripForm(made,
  { title: '방콕 5일', start: '2026-09-01', end: '2026-09-05', party: 3, hotel: '아속' });
eq('기간 연장 후 일차', edited.days.length, 5);
eq('연장해도 기존 일정 보존', edited.days[1].items, [{ id: 'i_k', time: '10:00', text: '왕궁' }]);
eq('id 유지', edited.id, madeId);
eq('제목 갱신', edited.title, '방콕 5일');
// 편집 경로는 호출자의 trip 객체를 건드리지 않고(non-mutating) 새 객체를 돌려준다 —
// showEdit가 재제출마다 같은 trip 참조를 넘기므로, 실패한 시도의 값으로 그 참조가
// 오염되면 재시도 성공 시 저장소의 온전한 값이 아니라 오염된 값을 써버리기 때문이다.
// reference 비동일성과, made(호출자 쪽 원본)가 그대로인지를 함께 확인한다.
eq('편집 경로는 caller의 trip 객체를 건드리지 않음(새 객체를 돌려줌)', edited === made, false);
eq('편집 경로 호출 후에도 caller의 원본 title은 그대로', made.title, '방콕');
eq('편집 경로 호출 후에도 caller의 원본 일차 수는 그대로', made.days.length, 4);

// 앞을 잘라내는 경우(shrink-from-start)도 보존이 성립해야 한다 — 인덱스 기반으로만
// 재동기화하는 잘못된 구현이면 날짜가 아니라 위치로 일정을 옮겨버려 여기서 걸린다.
var made2 = applyTripForm(null,
  { title: '삿포로', start: '2026-09-01', end: '2026-09-05', party: 2, hotel: '' });
made2.days[3].items.push({ id: 'i_s', time: '11:00', text: '오도리공원' }); // 2026-09-04
made2.days[3].theme = '공원';
var shrunk = applyTripForm(made2,
  { title: '삿포로', start: '2026-09-03', end: '2026-09-05', party: 2, hotel: '' });
eq('앞을 잘라내도 일차 수는 새 기간 기준', shrunk.days.length, 3);
eq('앞을 잘라내도 남은 날짜(09-04)의 일정 보존',
  shrunk.days[1].items, [{ id: 'i_s', time: '11:00', text: '오도리공원' }]);
eq('앞을 잘라내도 남은 날짜(09-04)의 테마 보존', shrunk.days[1].theme, '공원');
eq('앞을 잘라내면 번호도 새 위치로 재부여', shrunk.days[1].n, 2);

// ---- Important 1: <input type=date>가 허용하는 비정상 연도(예: 275760) → Date.parse가
// NaN을 돌려주고 daysBetween도 NaN이 되는데, 고치기 전에는 "NaN > 90"이 false라서
// 검증을 그냥 통과해버렸다(그 뒤 resyncDays가 일차 0개짜리 여행을 만듦).
eq('파싱 불가능한 연도는 daysBetween이 NaN', isNaN(daysBetween('275760-09-01', '275760-09-03')), true);
eq('파싱 불가능한 연도는 검증에서 거부됨',
  validateTripForm({ title: '방콕', start: '275760-09-01', end: '275760-09-03', party: 2 }),
  '날짜가 올바르지 않습니다.');

// ---- Important 2: saveTrip 실패(용량 초과·프라이빗 모드 등 조용한 no-op)를
// submitTripForm이 삼키지 않고 표면화하는지 — 새 여행/수정 두 경로 모두 확인.
(function () {
  __resetStorage();
  __setWritesFail(true);
  var r1 = submitTripForm(null,
    { title: '실패 여행', start: '2026-09-01', end: '2026-09-03', party: 2, hotel: '' });
  __setWritesFail(false);
  eq('새 여행 저장 실패는 ok:false로 보고됨', r1.ok, false);
  eq('새 여행 저장 실패 메시지', r1.message, '저장에 실패했습니다. 기기 저장 공간을 확인해 주세요.');
  eq('새 여행 저장 실패 시 목록에 고아 여행 없음', listTrips(), []);

  __resetStorage();
  var r0 = submitTripForm(null,
    { title: '원래 제목', start: '2026-09-01', end: '2026-09-03', party: 2, hotel: '' });
  eq('사전 준비: 정상 저장은 ok:true', r0.ok, true);
  var beforeTitle = loadTrip(r0.trip.id).title;

  __setWritesFail(true);
  var r2 = submitTripForm(r0.trip,
    { title: '고친 제목', start: '2026-09-01', end: '2026-09-04', party: 2, hotel: '' });
  __setWritesFail(false);
  eq('수정 저장 실패도 ok:false로 보고됨', r2.ok, false);
  eq('수정 저장 실패 시 저장소의 예전 값이 그대로 남음(덮어써지지 않음)',
    loadTrip(r0.trip.id).title, beforeTitle);
})();

// ---- Important 3: showEdit는 폼 제출마다 loadTrip(id)로 한 번 얻은 trip 참조를
// 재사용한다(재렌더하지 않으므로). 첫 시도가 실패했다가(예: 09-04에 일정이 있는데 종료일을
// 09-02로 줄여 제출) 그다음 시도를 원래 기간으로 재제출해 성공하면, 실패한 시도가 남긴
// 흔적이 아니라 저장소의 온전한 값 위에 적용돼야 한다. applyTripForm이 trip을 그 자리에서
// 고치던 예전 구현에서는 실패한 시도만으로도 참조가 오염돼 재시도가 성공해도 09-04
// 일정이 영구히 사라졌다 — non-mutating으로 바뀐 뒤에는 그 참조가 항상 저장소와 일치한
// 원본으로 남아 이 문제가 생기지 않는다.
(function () {
  __resetStorage();
  var r0 = submitTripForm(null,
    { title: '방콕', start: '2026-09-01', end: '2026-09-05', party: 2, hotel: '' });
  var tripRef = r0.trip; // showEdit의 closure가 붙들고 있는 것과 같은 참조
  tripRef.days[3].items.push({ id: 'i_r', time: '09:00', text: '왕궁' }); // 2026-09-04
  eq('사전 준비: 09-04 일정 저장 성공', saveTrip(tripRef), true);

  __setWritesFail(true);
  var rFail = submitTripForm(tripRef,
    { title: '방콕', start: '2026-09-01', end: '2026-09-02', party: 2, hotel: '' }); // 09-04를 떨구는 잘못된 제출
  __setWritesFail(false);
  eq('일차를 떨구는 제출은 실패로 보고됨', rFail.ok, false);
  eq('실패해도 저장소의 09-04 일정은 그대로', loadTrip(tripRef.id).days[3].items,
    [{ id: 'i_r', time: '09:00', text: '왕궁' }]);

  var rRetry = submitTripForm(tripRef,
    { title: '방콕', start: '2026-09-01', end: '2026-09-05', party: 2, hotel: '' }); // 원래 기간으로 재시도
  eq('원래 기간으로 재시도하면 성공', rRetry.ok, true);
  eq('재시도 성공 후에도 09-04 일정 보존(실패한 시도로 오염되지 않음)',
    loadTrip(tripRef.id).days[3].items, [{ id: 'i_r', time: '09:00', text: '왕궁' }]);
})();

// ---- Minor: saveTrip은 본체(큰 쓰기)와 인덱스(작은 쓰기)를 나눠 쓴다. 실제 용량 초과처럼
// 큰 쓰기만 실패하고 작은 쓰기는 성공하는 상황을 __setWriteSizeLimit으로 재현해, 본체
// 쓰기가 실패하면 인덱스도 건드리지 않는지 확인한다. __setWritesFail(모든 쓰기 실패)만으로는
// 이 본체/인덱스 분리 문제를 드러낼 수 없다(둘 다 실패하면 어떤 구현이든 통과해버림).
(function () {
  __resetStorage();
  var t = emptyTrip({ title: '큰 여행', start: '2026-09-01', end: '2026-09-05', party: 2, hotel: '' });
  __setWriteSizeLimit(300); // 인덱스 행(수십 바이트)은 통과, 본체(days 포함, 수백 바이트)는 실패
  var ok = saveTrip(t);
  __setWriteSizeLimit(-1);
  eq('본체 쓰기가 실패하면 saveTrip은 false', ok, false);
  eq('본체 쓰기 실패 시 목록에 고아 항목 없음', listTrips(), []);
  eq('본체 쓰기 실패 시 본체도 저장 안 됨(반쪽짜리 없음)', loadTrip(t.id), null);
})();

(function () {
  __resetStorage();
  var r0 = submitTripForm(null,
    { title: '원래 제목', start: '2026-09-01', end: '2026-09-03', party: 2, hotel: '' });
  var id = r0.trip.id;
  var edited = applyTripForm(loadTrip(id),
    { title: '고친 제목', start: '2026-09-01', end: '2026-09-03', party: 2, hotel: '' });
  __setWriteSizeLimit(300);
  var ok2 = saveTrip(edited);
  __setWriteSizeLimit(-1);
  eq('수정 시 본체 쓰기 실패는 saveTrip false', ok2, false);
  eq('수정 시 본체 쓰기 실패해도 목록의 제목은 예전 값 그대로(고스트 갱신 없음)',
    listTrips().filter(function (r) { return r.id === id; })[0].title, '원래 제목');
  eq('수정 시 본체 쓰기 실패해도 본체 저장소는 예전 값 그대로', loadTrip(id).title, '원래 제목');
})();

// ---- 일정 카드 편집 ----
function fixture() {
  return { id: 't_e', days: [
    { n: 1, date: '2026-09-01', items: [
      { id: 'a', time: '09:00', text: '출발' },
      { id: 'b', time: '14:00', text: '체크인' }
    ] },
    { n: 2, date: '2026-09-02', items: [] }
  ] };
}

eq('시간 정렬', sortItems([
  { id: 'x', time: '14:00' }, { id: 'y', time: '09:00' }, { id: 'z', time: '11:30' }
]).map(function (i) { return i.id; }), ['y', 'z', 'x']);
eq('같은 시간은 원래 순서', sortItems([
  { id: 'p', time: '09:00' }, { id: 'q', time: '09:00' }
]).map(function (i) { return i.id; }), ['p', 'q']);

var F = fixture();
addItem(F, 1, { time: '11:00', text: '점심' });
eq('추가 후 개수', F.days[0].items.length, 3);
eq('시간순 삽입', F.days[0].items.map(function (i) { return i.time; }),
  ['09:00', '11:00', '14:00']);
eq('추가 항목에 id 부여', F.days[0].items[1].id.slice(0, 2), 'i_');

var F2 = fixture();
updateItem(F2, 1, 'b', { time: '15:30', text: '체크인 변경' });
eq('수정된 텍스트', F2.days[0].items[1].text, '체크인 변경');
eq('수정된 시간', F2.days[0].items[1].time, '15:30');
eq('수정 후에도 정렬 유지', F2.days[0].items.map(function (i) { return i.time; }),
  ['09:00', '15:30']);

var F3 = fixture();
removeItem(F3, 1, 'a');
eq('삭제 후 개수', F3.days[0].items.length, 1);
eq('남은 항목', F3.days[0].items[0].id, 'b');

var F4 = fixture();
removeItem(F4, 1, '없는id');
eq('없는 id 삭제는 무해', F4.days[0].items.length, 2);
addItem(F4, 99, { time: '09:00', text: '없는 일차' });
eq('없는 일차 추가는 무해', F4.days.length, 2);

var F5 = fixture();
addItem(F5, 2, { time: '08:00', text: '첫 항목' });
eq('빈 일차에 추가', F5.days[1].items.length, 1);

// ---- 일차 격리(cross-day isolation): 대상 일차만 바뀌어야 한다. 개수만 보면
// "두 일차 모두에 쓰는" 잘못된 구현도 통과할 수 있으므로, 건드리지 않은 일차의
// items가 원래 값(빈 배열)과 완전히 같은지까지 확인한다.
var F6 = fixture();
addItem(F6, 1, { time: '10:00', text: '새 항목' });
eq('일정 추가는 다른 일차를 건드리지 않음', F6.days[1].items, []);

var F7 = fixture();
updateItem(F7, 1, 'b', { time: '16:00', text: '수정' });
eq('일정 수정은 다른 일차를 건드리지 않음', F7.days[1].items, []);

var F8 = fixture();
removeItem(F8, 1, 'a');
eq('일정 삭제는 다른 일차를 건드리지 않음', F8.days[1].items, []);

// ---- updateItem: 존재하지 않는 item id는 무해해야 한다(추가되지도, 기존 항목이
// 바뀌지도 않아야 함).
var F9 = fixture();
updateItem(F9, 1, '없는id', { time: '20:00', text: '유령 수정' });
eq('없는 item id 수정은 개수를 바꾸지 않음', F9.days[0].items.length, 2);
eq('없는 item id 수정은 기존 항목을 바꾸지 않음', F9.days[0].items, fixture().days[0].items);

// ---- Important 1: sortItems의 비교자는 time이 없거나 문자열이 아닌 항목이 섞여도
// 정상 항목끼리의 상대 순서를 지켜야 한다(예전엔 a<b, b<a가 둘 다 false가 되어
// 비교자가 모순에 빠졌고, V8에서 12개 중 6개가 time이 없는 목록이 통째로 뒤섞였다).
// malformed 항목은 정렬 키가 없는 셈이므로 맨 뒤로 보낸다(이 파일의 sortItems 주석 참고).
eq('time이 없는 항목은 맨 뒤로, 정상 항목끼리는 정렬 유지', sortItems([
  { id: 'a', time: '09:00' }, { id: 'b' }, { id: 'c', time: '05:00' }
]).map(function (i) { return i.id; }), ['c', 'a', 'b']);
eq('time이 문자열이 아닌 항목도 맨 뒤로, 정상 항목끼리는 정렬 유지', sortItems([
  { id: 'x', time: '14:00' }, { id: 'y', time: null }, { id: 'z', time: '09:00' },
  { id: 'w', time: 123 }
]).map(function (i) { return i.id; }), ['z', 'x', 'y', 'w']);
eq('malformed 항목끼리는 원래 순서를 유지(안정 정렬)', sortItems([
  { id: 'm1' }, { id: 'm2', time: undefined }, { id: 'm3', time: NaN }
]).map(function (i) { return i.id; }), ['m1', 'm2', 'm3']);

// ---- Important 2: normalizeTimeInput — prompt() 편집 경로가 저장 전에 거치는 검증/정규화.
eq('normalizeTimeInput: 정상 HH:MM은 그대로', normalizeTimeInput('09:00'), '09:00');
eq('normalizeTimeInput: 한 자리 시는 0-padding으로 정규화', normalizeTimeInput('9:00'), '09:00');
eq('normalizeTimeInput: 앞뒤 공백은 허용', normalizeTimeInput(' 9:05 '), '09:05');
eq('normalizeTimeInput: 24시는 범위 밖이라 null', normalizeTimeInput('24:00'), null);
eq('normalizeTimeInput: 분이 두 자리가 아니면 null', normalizeTimeInput('9:5'), null);
eq('normalizeTimeInput: 시각 형식이 아니면 null', normalizeTimeInput('9시'), null);
eq('normalizeTimeInput: 빈 문자열은 null', normalizeTimeInput(''), null);

// ---- Minor: renderTimeline(EDIT_MODE=true) — Task 8에서 새로 생긴 두 data-id 싱크
// (.it-edit, .it-del)는 지금까지 자동화된 이스케이프 커버리지가 없었다.
(function () {
  var HOSTILE = '"><img src=x onerror=alert(1)>';
  var escHostile = escHtml(HOSTILE);
  var day = {
    n: 1, date: "2026-07-28", theme: "", meals: [],
    items: [{ id: HOSTILE, time: "09:00", text: "테스트 일정" }]
  };
  var trip = { days: [day] };
  var st = { get: function (k, fb) { return fb; }, set: function () {} };
  var el = global.__setDomTarget("timeline");
  var prevEditMode = EDIT_MODE;
  EDIT_MODE = true;
  renderTimeline(trip, day, st);
  EDIT_MODE = prevEditMode;
  var html = el.innerHTML;

  eq('EDIT_MODE renderTimeline: raw <img> 태그가 어디에도 없음', html.indexOf('<img') === -1, true);
  eq('EDIT_MODE renderTimeline: it-edit 버튼의 data-id는 이스케이프됨',
    html.indexOf('class="it-edit" type="button" data-id="' + escHostile + '"') !== -1, true);
  eq('EDIT_MODE renderTimeline: it-del 버튼의 data-id는 이스케이프됨',
    html.indexOf('class="it-del" type="button" data-id="' + escHostile + '"') !== -1, true);
})();

// ---- Minor: afterItemEdit의 saveTripBody 실패 경로 — 이전 두 차례 리뷰가 계속 돌려보냈던
// 지점인데도 지금까지 자동화된 커버리지가 전혀 없었다. alert 호출, trip.days의 저장소
// 재동기화, 그리고(항목 편집이 실제로 실패한 게 아니라 재저장에 실패한 뒤에도) 올바른
// 재렌더까지 확인한다.
(function () {
  __resetStorage();
  var t0 = applyTripForm(null,
    { title: '실패 재현용', start: '2026-09-01', end: '2026-09-01', party: 2, hotel: '' });
  eq('사전 준비: 여행 저장 성공', saveTrip(t0), true);

  var trip = loadTrip(t0.id);
  var day = trip.days[0];
  addItem(trip, day.n, { time: '09:00', text: '원래 일정' });
  eq('사전 준비: 일정 추가 저장 성공', saveTripBody(trip), true);

  // 메모리 위에서만 한 번 더 편집한다(= 저장 직전 상태를 흉내). 이 편집은 저장에
  // 실패할 것이므로 저장소에는 반영되면 안 된다.
  addItem(trip, day.n, { time: '10:00', text: '저장 실패할 일정' });
  __setWriteSizeLimit(10); // 본체 JSON이 10바이트를 넘으므로 확실히 실패
  var ok = saveTripBody(trip);
  __setWriteSizeLimit(-1);
  eq('본체 쓰기 크기 초과로 실패', ok, false);

  var el = global.__setDomTarget('timeline');
  afterItemEdit(trip, day, tripStore(trip.id), ok);

  eq('저장 실패 시 alert가 호출됨', __alerts.length > 0, true);
  eq('저장 실패 시 trip.days가 저장소 값으로 되돌아감(phantom 일정 제거)',
    trip.days.filter(function (d) { return d.n === day.n; })[0].items.map(function (i) { return i.text; }),
    ['원래 일정']);
  eq('저장 실패해도 재렌더는 실행됨(빈 innerHTML 아님)', el.innerHTML.length > 0, true);
})();

// ---- Minor: afterItemEdit이 실패 후 되돌린 day에 items가 없어도(손상된 저장값) 던지지
// 않아야 한다 — showDay가 여는 경로에서 적용하는 보정(repaintDay)을 afterItemEdit도
// 거치는지 확인한다.
(function () {
  __resetStorage();
  var t0 = applyTripForm(null,
    { title: '손상된 일차', start: '2026-09-01', end: '2026-09-01', party: 1, hotel: '' });
  delete t0.days[0].items; // 저장소에 items 없는 day를 흉내
  eq('사전 준비: items 없는 day 저장 성공', saveTrip(t0), true);

  var trip = loadTrip(t0.id);
  var day = { n: trip.days[0].n };
  var el = global.__setDomTarget('timeline');
  var threw = false;
  try {
    afterItemEdit(trip, day, tripStore(trip.id), false);
  } catch (e) { threw = true; }
  eq('저장소에 items 없는 day가 있어도 afterItemEdit이 던지지 않음', threw, false);
})();

// ===================================================================
// 전체 브랜치 리뷰 지적 사항 회귀 테스트
// ===================================================================

// ---- Critical(F1): showTrip이 일차 탭 전환에서까지 loadTrip을 부르면 CUR.trip이 매번
// 새 객체로 갈아치워진다. 그런데 #summary/#fixed는 "여는" 경로에서만 다시 그려지므로
// 그 핸들러들은 이전 trip 객체를 계속 붙들고, 편집 토글을 누르는 순간 타임라인 전체가
// 그 낡은 스냅샷에 다시 묶여 탭 전환 이후 저장된 일정을 통째로 덮어써 지웠다.
(function () {
  __resetStorage();
  ['screen-list', 'screen-trip', 'screen-edit', 'summary', 'daytabs', 'timeline', 'fixed']
    .forEach(function (id) { global.__setDomTarget(id); });
  document.getElementById('screen-trip').hidden = true;
  // 여행을 열면 wxRefresh가 돈다 — 러너가 실제 네트워크를 타지 않게 fetch를 막는다.
  var prevFetch = global.fetch;
  global.fetch = function () {
    var p = { then: function () { return p; }, catch: function () { return p; } };
    return p;
  };

  var id = installSample();
  CUR.id = null; CUR.trip = null; CUR.st = null; CUR.dayN = null;

  showTrip(id, 'day', null);
  var a = CUR.trip;
  eq('여행을 열면 CUR.trip이 세워진다', !!a && a.id === id, true);

  showTrip(id, 'day', 2);
  eq('일차 전환은 trip 객체를 갈아치우지 않는다', CUR.trip === a, true);
  eq('일차 전환은 요청한 일차를 그린다', CUR.dayN, 2);

  // renderSummary의 편집 토글 핸들러(views.js)는 열 때 넘어온 trip을 클로저로 붙든다 —
  // showTrip(opening)에서만 renderSummary가 다시 불리므로, 탭 전환에서는 그 클로저가
  // 갱신되지 않는다. 버그가 있던 시절엔 showTrip이 탭 전환에서도 loadTrip을 다시 불러
  // CUR.trip을 매번 새 객체로 갈아치웠는데, 그러면 이 클로저가 붙든 "연" 시점의 trip과
  // 탭 전환 이후의 CUR.trip이 서로 다른 객체가 되어 버렸다. 그 상태에서 클로저 쪽(옛
  // 객체)으로 저장하면 탭 전환 뒤 CUR.trip 쪽에 저장한 내용을 통째로 덮어써 지운다.
  // 여기서도 그 클로저를 흉내내 "연" 시점의 trip 참조를 따로 붙든다.
  var staleRef = a;

  addItem(CUR.trip, 2, { time: '10:00', text: '탭 전환 뒤 추가' });
  eq('탭 전환 뒤 CUR.trip으로 추가한 일정 저장', saveTripBody(CUR.trip), true);

  // 편집 토글 핸들러가 하는 것과 같은 동작: 클로저가 붙든 낡은 참조로 저장.
  addItem(staleRef, 2, { time: '11:00', text: '클로저(연 시점) 참조로 추가' });
  saveTripBody(staleRef);

  eq('탭 전환 뒤 CUR.trip으로 저장한 일정이 그 뒤 편집 핸들러 저장에서 사라지지 않음',
    loadTrip(id).days[1].items.filter(function (it) {
      return it.text === '탭 전환 뒤 추가';
    }).length, 1);

  // 반대로 "여는" 경로(목록·편집 화면에서 되돌아옴)에서는 저장소에서 다시 읽어야 한다.
  document.getElementById('screen-trip').hidden = true;
  showTrip(id, 'day', null);
  eq('다시 열 때는 저장소에서 새로 읽는다', CUR.trip === a, false);

  global.fetch = prevFetch;
  CUR.id = null; CUR.trip = null; CUR.st = null; CUR.dayN = null;
})();

// ---- Important(F2): 식사 메모 키를 일차 번호가 아니라 날짜로 잡는다.
eq('mealKey: 날짜 기준', mealKey('2026-07-29', 0), 'meal:2026-07-29:0');
eq('mealMigrateKey: 번호 키를 날짜 키로 옮긴다',
  mealMigrateKey('meal:2:0', { '2': '2026-07-29' }), 'meal:2026-07-29:0');
eq('mealMigrateKey: 이미 날짜 기준이면 null(멱등의 근거)',
  mealMigrateKey('meal:2026-07-29:0', { '2': '2026-07-29' }), null);
eq('mealMigrateKey: 해당 번호의 일차가 없으면 null(고아 메모는 건드리지 않음)',
  mealMigrateKey('meal:9:0', { '2': '2026-07-29' }), null);
eq('mealMigrateKey: meal 키가 아니면 null', mealMigrateKey('spend', { '2': '2026-07-29' }), null);
eq('dayDateByN: 번호→날짜 표', dayDateByN({ days: [
  { n: 1, date: '2026-07-28' }, { n: 2, date: '2026-07-29' }
] }), { '1': '2026-07-28', '2': '2026-07-29' });

(function () {
  __resetStorage();
  var t = applyTripForm(null,
    { title: '교토', start: '2026-07-28', end: '2026-07-30', party: 2, hotel: '' });
  eq('사전 준비: 여행 저장', saveTrip(t), true);
  var st = tripStore(t.id);
  st.set('meal:2:0', '기온 우동');

  eq('migrateMealKeys: 옮긴 키 개수', migrateMealKeys(), 1);
  eq('migrateMealKeys: 날짜 기준 키로 옮겨짐', st.get('meal:2026-07-29:0', ''), '기온 우동');
  eq('migrateMealKeys: 구 번호 기준 키는 제거됨', st.get('meal:2:0', 'none'), 'none');
  // 멱등: 두 번째 실행은 아무 것도 옮기지 않고 값도 그대로다.
  eq('migrateMealKeys: 두 번째 실행은 옮길 게 없음', migrateMealKeys(), 0);
  eq('migrateMealKeys: 두 번 돌려도 값 보존', st.get('meal:2026-07-29:0', ''), '기온 우동');

  // 원래 결함: 시작일을 하루 앞당기면 resyncDays가 n을 다시 매겨 07-29가 2일차에서
  // 3일차가 된다 — 번호 기준 키였다면 메모가 통째로 어긋났다.
  var moved = applyTripForm(loadTrip(t.id),
    { title: '교토', start: '2026-07-27', end: '2026-07-30', party: 2, hotel: '' });
  eq('사전 준비: 기간 변경 저장', saveTrip(moved), true);
  var d29 = moved.days.filter(function (d) { return d.date === '2026-07-29'; })[0];
  eq('시작일을 앞당기면 07-29의 일차 번호가 바뀐다', d29.n, 3);
  eq('그래도 메모는 같은 날짜에 그대로 붙어 있다',
    st.get(mealKey(d29.date, 0), ''), '기온 우동');
})();

// migrateLegacy와 migrateMealKeys는 실행 순서와 무관하게 같은 결과를 낸다.
(function () {
  __resetStorage();
  lsSet('osaka-trip:v1:meal:2:0', '구시카츠 다루마');
  eq('구 데이터만 있을 때 migrateMealKeys를 먼저 돌려도 무해', migrateMealKeys(), 0);
  var mid2 = migrateLegacy();
  eq('순서를 바꿔도 날짜 기준으로 이관됨',
    tripStore(mid2).get('meal:2026-07-29:0', ''), '구시카츠 다루마');
  eq('그 뒤 migrateMealKeys를 또 돌려도 옮길 게 없음', migrateMealKeys(), 0);
  eq('이관 후 다시 돌려도 값 보존',
    tripStore(mid2).get('meal:2026-07-29:0', ''), '구시카츠 다루마');
})();

// ---- Important(F3): 추가 폼도 prompt 경로와 같은 시간 정규화·검증을 거친다.
eq('parseItemInput: 정상 입력', parseItemInput('09:00', ' 점심 '),
  { ok: true, time: '09:00', text: '점심' });
eq('parseItemInput: 한 자리 시는 정규화된다(type=time이 text로 떨어지는 환경)',
  parseItemInput('9:00', '점심').time, '09:00');
eq('parseItemInput: 잘못된 시간은 거부', parseItemInput('9시', '점심'),
  { ok: false, message: MSG_BAD_TIME });
eq('parseItemInput: 빈 시간은 거부', parseItemInput('', '점심').ok, false);
eq('parseItemInput: 빈 내용은 거부', parseItemInput('09:00', '   '),
  { ok: false, message: MSG_EMPTY_TEXT });
eq('두 입력 경로가 같은 시간 오류 메시지를 쓴다', MSG_BAD_TIME,
  '시간 형식이 올바르지 않습니다. 예: 09:00');

// ---- Important(F4): 일정이 하나도 없는 일차(새 여행의 1일차)에 안내 문구를 보여준다.
(function () {
  var EMPTY_MSG = '아직 일정이 없습니다. 편집을 눌러 추가해 보세요.';
  var trip = { days: [{ n: 1, date: '2026-07-28', theme: '', items: [], meals: [] }] };
  var st = { get: function (k, fb) { return fb; }, set: function () {} };
  var prev = EDIT_MODE;

  var el = global.__setDomTarget('timeline');
  EDIT_MODE = false;
  renderTimeline(trip, trip.days[0], st);
  eq('빈 일차에는 안내 문구가 보인다', el.innerHTML.indexOf(EMPTY_MSG) !== -1, true);

  // 편집 모드에서는 바로 아래에 추가 폼이 있으므로 안내가 필요 없다.
  var el2 = global.__setDomTarget('timeline');
  EDIT_MODE = true;
  renderTimeline(trip, trip.days[0], st);
  eq('편집 모드의 빈 일차에는 안내 대신 추가 폼', el2.innerHTML.indexOf(EMPTY_MSG) === -1, true);
  eq('편집 모드의 빈 일차에는 추가 폼이 있다',
    el2.innerHTML.indexOf('class="item-add"') !== -1, true);

  // 일정이 있으면 안내 문구는 나오지 않는다.
  var el3 = global.__setDomTarget('timeline');
  EDIT_MODE = false;
  var day2 = { n: 1, date: '2026-07-28', theme: '', meals: [],
               items: [{ id: 'a', time: '09:00', text: '출발' }] };
  renderTimeline({ days: [day2] }, day2, st);
  eq('일정이 있으면 안내 문구는 없다', el3.innerHTML.indexOf(EMPTY_MSG) === -1, true);

  EDIT_MODE = prev;
})();

// ---- Minor(F5): 숙소는 여러 줄 textarea다 — 줄바꿈이 사라지면 안 된다.
(function () {
  var HOTEL = '호텔 그란비아\n체크인 15:00 / 체크아웃 11:00';
  var trip = { title: '테스트', start: '2026-07-28', end: '2026-08-03',
               hotel: HOTEL, party: 2, budgetKRW: 0 };
  var st = { get: function (k, fb) { return fb; }, set: function () {} };
  var el = global.__setDomTarget('summary');
  renderSummary(trip, st);
  eq('요약 헤더의 숙소 줄바꿈은 가운뎃점으로 이어진다(day.theme과 동일)',
    el.innerHTML.indexOf('🏨 호텔 그란비아 · 체크인 15:00 / 체크아웃 11:00') !== -1, true);

  var body = sectionBodyHtml(trip, { type: 'builtin', body: 'hotel' });
  eq('숙소 섹션 본문은 줄 단위로 그린다',
    body, '<div class="line">호텔 그란비아</div>' +
          '<div class="line">체크인 15:00 / 체크아웃 11:00</div>');
  eq('숙소가 비면 섹션 본문도 빈 문자열',
    sectionBodyHtml({ hotel: '' }, { type: 'builtin', body: 'hotel' }), '');
})();

// ---- Minor(F7): installSample은 저장 성공 여부를 삼키지 않는다.
(function () {
  __resetStorage();
  var okId = installSample();
  eq('샘플 설치 성공 시 id 반환', typeof okId, 'string');
  eq('샘플 설치 성공 시 실제로 저장됨', loadTrip(okId).title, '오사카 여행');

  __resetStorage();
  __setWritesFail(true);
  var failId = installSample();
  __setWritesFail(false);
  eq('샘플 저장 실패 시 null 반환', failId, null);
  eq('샘플 저장 실패 시 목록에 고아 항목 없음', listTrips(), []);
})();

// ---- Minor(F8): 손상된 일차(items/date/item.text 누락)도 렌더가 던지지 않는다.
eq('normalizeDay: items가 배열이 아니면 빈 배열',
  normalizeDay({ n: 1, date: '2026-07-28' }).items, []);
eq('normalizeDay: date가 문자열이 아니면 빈 문자열', normalizeDay({ n: 1 }).date, '');
eq('normalizeDay: meals가 배열이 아니면 빈 배열(렌더가 .map을 부름 — views.js renderTimeline)',
  normalizeDay({ n: 1, date: '2026-07-28', meals: '저녁' }).meals, []);
eq('normalizeDay: item.text가 없으면 빈 문자열',
  normalizeDay({ n: 1, date: '', items: [{ id: 'a', time: '09:00' }] }).items[0].text, '');
eq('normalizeDay: 항목이 아닌 값은 걸러낸다',
  normalizeDay({ n: 1, items: [null, { id: 'a' }, 3] }).items.length, 1);
eq('normalizeDay: 정상 일차는 그대로', normalizeDay(
  { n: 1, date: '2026-07-28', items: [{ id: 'a', time: '09:00', text: '출발' }] }).items,
  [{ id: 'a', time: '09:00', text: '출발' }]);
eq('normalizeDay: null은 null', normalizeDay(null), null);
eq('dowOf: 파싱 불가능한 날짜는 빈 문자열', dowOf(''), '');
eq('isUndecided: text가 없어도 던지지 않고 미정으로 본다', isUndecided(undefined), true);

(function () {
  // 선택되지 않은 일차의 date까지 renderTabs가 읽는다 — 그 일차가 손상돼 있어도
  // 화면 전체가 죽으면 안 된다.
  var trip = { id: 't_broken', days: [
    { n: 1, date: '2026-07-28', theme: '', meals: [],
      items: [{ id: 'a', time: '09:00' }] },
    { n: 2 }
  ] };
  var st = { get: function (k, fb) { return fb; }, set: function () {} };
  global.__setDomTarget('daytabs');
  var el = global.__setDomTarget('timeline');
  var threw = false;
  try {
    var day = pickDay(trip, 1, '2026-07-28');
    renderTabs(trip, 1, function () {});
    renderTimeline(trip, day, st);
  } catch (e) { threw = true; }
  eq('date 없는 일차가 섞여 있어도 렌더가 던지지 않음', threw, false);
  eq('text 없는 항목도 그려진다(미정 처리)', el.innerHTML.indexOf('slot undecided') !== -1, true);
})();

// ---- 하단 내비: 해시 파싱 ----
eq('탭 키 목록', TAB_KEYS, ['day', 'hotel', 'packing', 'money', 'info']);
eq('탭 정의 개수', TAB_DEFS.length, 5);

eq('여행 루트는 일정 탭', parseTripHash('#/t/t_a'), { id: 't_a', tab: 'day', dayN: null });
eq('일차 지정', parseTripHash('#/t/t_a/d/3'), { id: 't_a', tab: 'day', dayN: 3 });
eq('숙소 탭', parseTripHash('#/t/t_a/hotel'), { id: 't_a', tab: 'hotel', dayN: null });
eq('준비물 탭', parseTripHash('#/t/t_a/packing'), { id: 't_a', tab: 'packing', dayN: null });
eq('경비 탭', parseTripHash('#/t/t_a/money'), { id: 't_a', tab: 'money', dayN: null });
eq('정보 탭', parseTripHash('#/t/t_a/info'), { id: 't_a', tab: 'info', dayN: null });

// edit은 탭이 아니다 — 라우터가 따로 처리하므로 여기서 걸리면 안 된다
eq('편집 화면은 탭으로 안 잡힘', parseTripHash('#/t/t_a/edit'), null);
eq('목록은 null', parseTripHash('#/'), null);
eq('빈 해시는 null', parseTripHash(''), null);
eq('새 여행은 null', parseTripHash('#/new'), null);
eq('모르는 탭은 null', parseTripHash('#/t/t_a/zzz'), null);
eq('꼬리가 더 붙으면 null', parseTripHash('#/t/t_a/money/x'), null);
eq('일차가 숫자 아니면 null', parseTripHash('#/t/t_a/d/abc'), null);

eq('해시 생성 일정', tabHash('t_a', 'day'), '#/t/t_a');
eq('해시 생성 일차', tabHash('t_a', 'day', 3), '#/t/t_a/d/3');
eq('해시 생성 경비', tabHash('t_a', 'money'), '#/t/t_a/money');

// ---- 하단 내비: 패널 HTML ----
var PT = {
  id: 't_p', title: '여행', start: '2026-09-01', end: '2026-09-03', party: 2,
  hotel: '빈펄 리조트\n체크인 14시',
  budgetKRW: 0, days: [], packing: [], expenses: [],
  sections: [{ id: 's1', icon: '🚄', title: '기차', type: 'list', body: ['08:00 출발'] }]
};

eq('숙소 패널은 줄바꿈을 살린다',
  panelHtml(PT, 'hotel').indexOf('<div class="line">체크인 14시</div>') >= 0, true);
eq('숙소 없으면 빈 상태',
  panelHtml({ hotel: '' }, 'hotel').indexOf('class="empty"') >= 0, true);
eq('숙소 패널 XSS',
  panelHtml({ hotel: '<img src=x onerror=alert(1)>' }, 'hotel').indexOf('<img') === -1, true);

eq('준비물 패널은 packing-body 컨테이너',
  panelHtml(PT, 'packing').indexOf('id="packing-body"') >= 0, true);

eq('경비 패널은 spend-body 컨테이너',
  panelHtml(PT, 'money').indexOf('id="spend-body"') >= 0, true);
eq('경비 내역 없으면 표를 안 그린다',
  panelHtml(PT, 'money').indexOf('<table') === -1, true);
eq('경비 내역 있으면 표를 그린다',
  panelHtml({ hotel: '', expenses: [{ date: '2026-08-01', cat: '항공', detail: '왕복', krw: 300000 }],
              sections: [] }, 'money').indexOf('<table') >= 0, true);

eq('정보 패널은 사용자 섹션을 그린다',
  panelHtml(PT, 'info').indexOf('기차') >= 0, true);
eq('정보 패널 섹션 없으면 빈 상태',
  panelHtml({ sections: [] }, 'info').indexOf('class="empty"') >= 0, true);
eq('정보 패널 섹션 제목 XSS',
  panelHtml({ sections: [{ id: 's', icon: '📌', title: '<img src=x>', type: 'list', body: [] }] },
    'info').indexOf('<img src=x>') === -1, true);

eq('일정 탭은 패널을 안 쓴다', panelHtml(PT, 'day'), '');
