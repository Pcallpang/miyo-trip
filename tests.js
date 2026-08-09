// 브라우저(test.html)와 Node(test-node.js) 양쪽에서 로드된다.
// 러너가 전역 eq(name, got, want)를 미리 정의해 둔다. 여기서는 단언만 쓴다.

// 경비 레코드는 통화를 함께 담는다({amount, cur}) — 2단계-B에서 {jpy}에서 옮겼다.
var L = [
  { id: 1, date: "2026-07-29", amount: 1200, cur: "JPY", cat: "식비", note: "이치란" },
  { id: 2, date: "2026-07-29", amount: 800,  cur: "JPY", cat: "교통", note: "지하철" },
  { id: 3, date: "2026-07-30", amount: 2000, cur: "JPY", cat: "식비", note: "저녁" },
  { id: 4, date: "2026-07-28", amount: 500,  cur: "JPY", cat: "기타", note: "" }
];

eq('통화별 합계(단일 통화)', spendTotals(L), [{ cur: "JPY", amount: 4500 }]);
eq('빈 목록 합계', spendTotals([]), []);
eq('잘못된 금액은 0으로',
  spendTotals([{amount:"abc",cur:"JPY"},{amount:100,cur:"JPY"}]), [{ cur:"JPY", amount:100 }]);

eq('분류별 집계', spendByCat(L), [
  { cat: "식비", cur: "JPY", amount: 3200 },
  { cat: "교통", cur: "JPY", amount: 800 },
  { cat: "기타", cur: "JPY", amount: 500 }
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
  { n: 1, date: '2026-07-28', theme: '', place: null, curCode: null, hotel: null,
    items: [], meals: [], notes: [] });

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

// 내장 섹션(숙소·준비물·경비)은 하단 탭이 됐다 — sections에는 사용자가 만든 것만 남는다.
eq('새 여행의 기본 섹션은 없음', defaultSections(), []);

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
      notes: [{ id: HOSTILE, text: HOSTILE }]
    };
    var trip = { days: [day] };
    var st = makeSt();

    var el = global.__setDomTarget("timeline");
    renderTimeline(trip, day, st);
    var html = el.innerHTML;

// 미요 캐릭터 <img>는 앱이 스스로 내는 것이라 존재가 정상이다. 지켜야 할 계약은
    // "사용자 입력이 태그가 되지 않는다" — 공격 문자열이 살아 있는 태그로 나오지
    // 않는지, 그리고 그 어떤 img도 우리 자산(assets/miyo/)만 가리키는지로 잰다.
    eq('renderTimeline: 사용자 입력이 태그가 되지 않는다',
      html.indexOf('<img src=x') === -1, true);
    eq('renderTimeline: img는 미요 자산만 가리킨다',
      (html.match(/<img[^>]*>/g) || []).every(function (t) {
        return t.indexOf('src="assets/miyo/') !== -1;
      }), true);
    eq('renderTimeline: 문자열이 와야 할 data-item 속성은 이스케이프됨',
      html.indexOf('data-item="' + escHostile + '"') !== -1, true);
    // 메모 본문·id는 이제 카드가 아니라 메모 모달 안에서만 그려진다 — 카드에는
    // 개수만 나오므로 외부 문자열이 흘러들 자리가 없다(모달 쪽 계약은 아래에서 잰다).
    // (escHostile 자체는 item.id로도 쓰이는 fixture라 존재한다 — 메모 쪽 진입점인
    // data-id가 사라졌는지로 잰다.)
    eq('renderTimeline: 메모 id는 카드에 나오지 않는다',
      html.indexOf('data-id=') === -1, true);
    eq('renderTimeline: 메모 개수만 배지로 알린다',
      html.indexOf('<span class="nbadge">1</span>') !== -1, true);
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

// 미요 캐릭터 <img>는 앱이 스스로 내는 것이라 존재가 정상이다. 지켜야 할 계약은
    // "사용자 입력이 태그가 되지 않는다" — 공격 문자열이 살아 있는 태그로 나오지
    // 않는지, 그리고 그 어떤 img도 우리 자산(assets/miyo/)만 가리키는지로 잰다.
    eq('renderTabs: 사용자 입력이 태그가 되지 않는다',
      html.indexOf('<img src=x') === -1, true);
    eq('renderTabs: img는 미요 자산만 가리킨다',
      (html.match(/<img[^>]*>/g) || []).every(function (t) {
        return t.indexOf('src="assets/miyo/') !== -1;
      }), true);
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

// 미요 캐릭터 <img>는 앱이 스스로 내는 것이라 존재가 정상이다. 지켜야 할 계약은
    // "사용자 입력이 태그가 되지 않는다" — 공격 문자열이 살아 있는 태그로 나오지
    // 않는지, 그리고 그 어떤 img도 우리 자산(assets/miyo/)만 가리키는지로 잰다.
    eq('renderSummary: 사용자 입력이 태그가 되지 않는다',
      html.indexOf('<img src=x') === -1, true);
    eq('renderSummary: img는 미요 자산만 가리킨다',
      (html.match(/<img[^>]*>/g) || []).every(function (t) {
        return t.indexOf('src="assets/miyo/') !== -1;
      }), true);
    eq('renderSummary: budgetKRW/party 문자열은 숫자로 강제 변환되어 안전함',
      html.indexOf('NaN원 (NaN인)') !== -1, true);
  })();

  // renderSummary: 여행 화면에서 목록으로 돌아가는 버튼이 항상 있어야 한다
  // (여행이 하나뿐이어도 — 목록에서 새 여행을 만들거나 지울 수 있어야 하므로).
  // 클릭 핸들러 동작 자체는 이 Node 스텁의 querySelector가 항상 null이라 여기서
  // 검증할 수 없다(addEventListener도 no-op) — 마크업 존재만 확인하고, 실제 이동은
  // 브라우저에서 확인한다.
  (function () {
    var trip = {
      id: "t_x", title: "테스트", start: "2026-07-28", end: "2026-08-03",
      hotel: "", party: 2, budgetKRW: 0
    };
    var st = { get: function (k, fb) { return fb; }, set: function () {} };
    var el = global.__setDomTarget("summary");
    renderSummary(trip, st);
    var html = el.innerHTML;

    eq('renderSummary: 목록 버튼 마크업 존재', html.indexOf('class="back-list"') !== -1, true);
    eq('renderSummary: 목록 버튼이 접근성 라벨을 가짐',
      html.indexOf('aria-label="여행 목록"') !== -1, true);
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
      eq('renderSummary: 예산 0·경비 있음 → 현지 줄 표시', cost.indexOf('현지') !== -1, true);
      eq('renderSummary: 예산 0·경비 있음 → 총 줄은 없음', cost.indexOf('총') === -1, true);
      eq('renderSummary: 예산 0·경비 있음 → 선행 구분자(·) 없음', cost.indexOf('· 현지') === -1, true);
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

      eq('renderSummary: 예산·경비 모두 있음 → 총 줄 표시', cost.indexOf('총') !== -1, true);
      eq('renderSummary: 예산·경비 모두 있음 → 현지 줄 표시', cost.indexOf('현지') !== -1, true);
      eq('renderSummary: 예산·경비 모두 있음 → 구분자(·)로 연결됨',
        cost.indexOf('· 현지') !== -1, true);
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

// ---- 일정 줄은 그 자체가 편집 버튼이다(.slot). 편집 진입점이 data-item 하나로
// 줄었으므로 그 속성의 이스케이프를 지킨다.
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
  renderTimeline(trip, day, st);
  var html = el.innerHTML;

  eq('탭편집 renderTimeline: 사용자 입력이 태그가 되지 않는다',
    html.indexOf('<img src=x') === -1, true);
  eq('탭편집 renderTimeline: 일정 줄은 button이고 data-item이 이스케이프됨',
    html.indexOf('<button class="slot" type="button" data-item="' + escHostile + '"') !== -1, true);
  eq('탭편집 renderTimeline: 일정 추가 버튼은 편집 토글 없이도 항상 나온다',
    html.indexOf('class="day-add-item"') !== -1, true);
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
  var EMPTY_MSG = '아직 일정이 없습니다. 위 + 를 눌러 추가해 보세요.';
  var trip = { days: [{ n: 1, date: '2026-07-28', theme: '', items: [], meals: [] }] };
  var st = { get: function (k, fb) { return fb; }, set: function () {} };

  var el = global.__setDomTarget('timeline');
  renderTimeline(trip, trip.days[0], st);
  eq('빈 일차에는 안내 문구가 보인다', el.innerHTML.indexOf(EMPTY_MSG) !== -1, true);
  // 추가 버튼은 편집 토글 없이 늘 보인다. 입력은 카드에 붙는 폼이 아니라 모달에서
  // 받는다 — 스크롤이 길어지지 않게.
  eq('빈 일차에도 일정 추가 버튼이 있다',
    el.innerHTML.indexOf('class="day-add-item"') !== -1, true);
  eq('빈 일차에도 메모 버튼이 있다',
    el.innerHTML.indexOf('class="day-note"') !== -1, true);
  // 메모가 없으면 개수 배지도 없다.
  eq('메모가 없으면 배지도 없다',
    el.innerHTML.indexOf('nbadge') === -1, true);
  eq('추가 폼은 카드에 붙지 않는다(모달로 이동)',
    el.innerHTML.indexOf('class="item-add"') === -1, true);

  // 일정이 있으면 안내 문구는 나오지 않는다.
  var el3 = global.__setDomTarget('timeline');
  var day2 = { n: 1, date: '2026-07-28', theme: '', meals: [],
               items: [{ id: 'a', time: '09:00', text: '출발' }] };
  renderTimeline({ days: [day2] }, day2, st);
  eq('일정이 있으면 안내 문구는 없다', el3.innerHTML.indexOf(EMPTY_MSG) === -1, true);
})();

// ---- Minor(F5): 숙소는 여러 줄 textarea다 — 줄바꿈이 사라지면 안 된다.
(function () {
  var HOTEL = '호텔 그란비아\n체크인 15:00 / 체크아웃 11:00';
  var trip = { title: '테스트', start: '2026-07-28', end: '2026-08-03',
               hotel: HOTEL, party: 2, budgetKRW: 0 };
  var st = { get: function (k, fb) { return fb; }, set: function () {} };
  // 숙소는 요약 헤더에서 뺐다 — 일차 카드가 그날 숙소를 보여주므로 겹친다.
  var el = global.__setDomTarget('summary');
  renderSummary(trip, st);
  eq('요약 헤더에는 숙소 줄이 없다', el.innerHTML.indexOf('🏨') === -1, true);

  // 대신 일차 카드에 그날 숙소가 한 줄로 붙는다(줄바꿈은 가운뎃점으로).
  var day = { n: 1, date: '2026-07-28', theme: '', items: [], meals: [], notes: [] };
  var el2 = global.__setDomTarget('timeline');
  renderTimeline({ days: [day], hotel: HOTEL }, day, st);
  eq('일차 카드의 숙소 줄바꿈은 가운뎃점으로 이어진다',
    el2.innerHTML.indexOf('🏨 호텔 그란비아 · 체크인 15:00 / 체크아웃 11:00') !== -1, true);

  // 숙소 탭은 여행 기본 숙소를 줄 단위로 그린다(계약 그대로).
  var body = panelHtml(trip, 'hotel');
  eq('숙소 탭 본문은 줄 단위로 그린다',
    body.indexOf('<div class="line">체크인 15:00 / 체크아웃 11:00</div>') >= 0, true);
  eq('숙소가 비면 입력하라고 알린다',
    panelHtml({ hotel: '', days: [] }, 'hotel').indexOf('hr-none') >= 0, true);
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
eq('숙소 없으면 입력 안내',
  panelHtml({ hotel: '', days: [] }, 'hotel').indexOf('hr-none') >= 0, true);
// 미요 아이콘 <img>는 앱이 내는 것이라 정상 — 사용자 입력이 태그가 되지 않는지만 본다.
eq('숙소 패널 XSS',
  panelHtml({ hotel: '<img src=x onerror=alert(1)>', days: [] }, 'hotel')
    .indexOf('<img src=x') === -1, true);

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

// ---- 내장 섹션 제거 ----
eq('builtin만 걸러낸다', stripBuiltinSections([
  { id: 'a', type: 'table' }, { id: 'b', type: 'builtin', body: 'hotel' },
  { id: 'c', type: 'list' },  { id: 'd', type: 'builtin', body: 'spend' }
]).map(function (s) { return s.id; }), ['a', 'c']);
eq('builtin이 없으면 그대로', stripBuiltinSections([{ id: 'a', type: 'list' }]).length, 1);
eq('빈 배열도 안전', stripBuiltinSections([]), []);
eq('배열이 아니면 빈 배열', stripBuiltinSections(null), []);

eq('새 여행은 섹션이 비어 있다', defaultSections(), []);

(function () {
  __resetStorage();
  var t = emptyTrip({ title: '테스트', start: '2026-09-01', end: '2026-09-02' });
  t.sections = [
    { id: 'u1', icon: '🚄', title: '기차', type: 'list', body: ['a'] },
    { id: 'b1', icon: '🏨', title: '숙소', type: 'builtin', body: 'hotel' }
  ];
  saveTrip(t);
  eq('마이그레이션이 한 여행을 고침', migrateSections(), 1);
  eq('builtin이 사라짐', loadTrip(t.id).sections.map(function (s) { return s.id; }), ['u1']);
  eq('두 번째 실행은 0건', migrateSections(), 0);
})();

eq('샘플 여행에 builtin 섹션 없음',
  window.SAMPLE_TRIP.sections.filter(function (s) { return s.type === 'builtin'; }).length, 0);
// 라피트 시간표(오사카 공항철도 시간표)는 뺐다 — 정보 탭은 나라 정보가 먼저 보여야
// 하는 자리다. 사용자 섹션이 어떤 것인지 보여주는 예시로는 '팁' 하나면 충분하다.
eq('샘플 여행의 사용자 섹션은 하나',
  window.SAMPLE_TRIP.sections.map(function (s) { return s.title; }), ['팁']);

// ---- 샘플 여행: 나라 정보와 결제 내역 편집 ----
// 정보 탭의 나라 카드는 trip.countryCode로 그린다 — 샘플에 없으면 카드가 안 나온다.
eq('샘플 여행에 나라 코드가 있다', window.SAMPLE_TRIP.countryCode, 'JP');
eq('샘플 정보 탭에 나라 카드', panelHtml(window.SAMPLE_TRIP, 'info').indexOf('일본 정보') >= 0, true);
eq('샘플 정보 탭에 전압', panelHtml(window.SAMPLE_TRIP, 'info').indexOf('100V') >= 0, true);

// 결제 내역은 id로 가리켜 수정·삭제한다. id가 없으면 줄을 눌러도 아무 일이 없다 —
// migrateExpenseIds는 부팅 때 한 번 도는데 샘플 설치는 그보다 나중이라, 설치 시점에
// 채워야 한다.
(function () {
  __resetStorage();
  var id = installSample();
  var t = loadTrip(id);
  eq('설치된 샘플의 결제 내역에 모두 id가 있다',
    t.expenses.every(function (e) { return !!e.id; }), true);
  eq('id는 서로 다르다',
    t.expenses.map(function (e) { return e.id; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).length, t.expenses.length);
  // 그 id로 실제 수정이 되는지(줄을 눌러 여는 경로가 쓰는 함수 그대로).
  var first = t.expenses[0];
  updateExpense(t, first.id, { cat: '항공권', krw: 700000, detail: '왕복 2인', date: '', pay: '', note: '' });
  eq('결제 내역 수정됨', t.expenses[0].krw, 700000);
  eq('표의 줄이 id를 달고 나온다',
    expensesTableHtml(t).indexOf('data-id="' + first.id + '"') >= 0, true);
})();

// ---- 좌표별 날씨 캐시 ----
var OSAKA = { name: '오사카', lat: 34.69379, lon: 135.50107, tz: 'Asia/Tokyo' };
var DANANG = { name: '다낭', lat: 16.06778, lon: 108.22083, tz: 'Asia/Ho_Chi_Minh' };

eq('wxKey 좌표 조합', wxKey(OSAKA), '34.694,135.501');
eq('wxKey 반올림', wxKey({ lat: 1.23456, lon: 2.99999 }), '1.235,3');
eq('wxKey place 없으면 빈 문자열', wxKey(null), '');

eq('wxUrl에 좌표가 들어간다', wxUrl(DANANG).indexOf('latitude=16.06778') >= 0, true);
eq('wxUrl에 시간대가 들어간다',
  wxUrl(DANANG).indexOf('timezone=Asia%2FHo_Chi_Minh') >= 0, true);
eq('wxUrl은 16일 예보', wxUrl(OSAKA).indexOf('forecast_days=16') >= 0, true);

// 좌표가 다르면 캐시가 섞이지 않는다
(function () {
  __resetStorage();
  wxResetAll();
  var st = tripStore('t_w');
  var apiO = { daily: { time: ['2026-09-01'], weather_code: [0],
    temperature_2m_max: [30], temperature_2m_min: [20], precipitation_probability_max: [10] } };
  var apiD = { daily: { time: ['2026-09-01'], weather_code: [61],
    temperature_2m_max: [33], temperature_2m_min: [26], precipitation_probability_max: [80] } };
  st.set('wx:' + wxKey(OSAKA), { at: '2026-09-01T00:00:00Z', api: apiO });
  st.set('wx:' + wxKey(DANANG), { at: '2026-09-01T00:00:00Z', api: apiD });

  eq('오사카 캐시를 읽는다', wxLine(wxGet(st, OSAKA).map, '2026-09-01'), '☀️ 30° / 20° · 비 10%');
  eq('다낭 캐시를 읽는다', wxLine(wxGet(st, DANANG).map, '2026-09-01'), '🌧️ 33° / 26° · 비 80%');
  eq('캐시 없는 좌표는 빈 맵', wxGet(st, { lat: 1, lon: 1 }).map, {});
})();

// ---- 도시 검색 ----
eq('geoUrl 질의 인코딩', geoUrl('Da Nang', 5).indexOf('name=Da%20Nang') >= 0, true);
eq('geoUrl은 한국어 표시', geoUrl('Da Nang', 5).indexOf('language=ko') >= 0, true);
// language=en 폴백은 쓰지 않는다 — language는 검색 색인을 고르므로, en으로 바꾸면
// 한국어 질의가 오히려 전부 0건이 된다(2026-08-06 브라우저 실측).
eq('geoUrl에 en 폴백 흔적 없음', geoUrl('x', 5).indexOf('language=en') === -1, true);

var GEOAPI = { results: [
  { name: '다낭', country: '베트남', latitude: 16.06778, longitude: 108.22083,
    timezone: 'Asia/Ho_Chi_Minh', admin1: 'Da Nang City' },
  { name: '다낭 국제공항', country: '베트남', latitude: 16.04392, longitude: 108.19937,
    timezone: 'Asia/Ho_Chi_Minh', admin1: 'Da Nang City' }
] };
eq('geoParse 변환', geoParse(GEOAPI)[0],
  { name: '다낭', country: '베트남', lat: 16.06778, lon: 108.22083, tz: 'Asia/Ho_Chi_Minh' });
eq('geoParse 개수', geoParse(GEOAPI).length, 2);
// 0건일 때 응답에는 results 키 자체가 없다(실측) — 빈 배열로 받아야 한다.
eq('geoParse 0건 응답', geoParse({ generationtime_ms: 0.1 }), []);
eq('geoParse null 응답', geoParse(null), []);

eq('placeLabel 조합', placeLabel({ name: '다낭', country: '베트남' }), '다낭 · 베트남');
eq('placeLabel 국가 없으면 이름만', placeLabel({ name: '다낭' }), '다낭');
eq('placeLabel 없으면 빈 문자열', placeLabel(null), '');

// ---- 일차별 도시 ----
(function () {
  var trip = { place: { name: '하노이', lat: 21, lon: 105, tz: 'Asia/Bangkok' },
    days: [{ n: 1, place: null }, { n: 2, place: null }] };
  var P = { name: '다낭', country: '베트남', lat: 16.06778, lon: 108.22083, tz: 'Asia/Ho_Chi_Minh' };

  setDayPlace(trip, 2, P);
  eq('일차 도시 지정', trip.days[1].place.name, '다낭');
  eq('지정 안 한 일차는 여행 기본값 상속', dayPlace(trip, trip.days[0]).name, '하노이');
  eq('지정한 일차는 그 도시', dayPlace(trip, trip.days[1]).name, '다낭');

  setDayPlace(trip, 2, null);
  eq('null이면 상속으로 되돌아감', trip.days[1].place, null);
  eq('되돌린 뒤 상속 확인', dayPlace(trip, trip.days[1]).name, '하노이');

  eq('없는 일차는 무해', setDayPlace(trip, 99, P).days.length, 2);
})();

// ---- 경비 레코드 마이그레이션 ----
eq('구 레코드 변환', migrateSpendRecord({ id:1, date:'2026-07-29', jpy:1200, cat:'식비', note:'이치란' }, 'JPY'),
  { id:1, date:'2026-07-29', cat:'식비', note:'이치란', amount:1200, cur:'JPY' });
eq('이미 새 형식이면 그대로',
  migrateSpendRecord({ id:2, date:'2026-07-29', amount:500, cur:'USD', cat:'교통', note:'' }, 'JPY').cur, 'USD');
eq('기본 통화를 따른다',
  migrateSpendRecord({ id:3, date:'2026-07-29', jpy:900, cat:'기타', note:'' }, 'VND').cur, 'VND');
eq('금액이 숫자가 아니면 0', migrateSpendRecord({ id:4, jpy:'abc' }, 'JPY').amount, 0);

(function () {
  __resetStorage();
  var t = emptyTrip({ title:'테스트', start:'2026-09-01', end:'2026-09-02' });
  t.currency = { code:'JPY', symbol:'¥', decimals:0, unit:100 };
  saveTrip(t);
  tripStore(t.id).set('spend', [
    { id:1, date:'2026-09-01', jpy:1200, cat:'식비', note:'라멘' },
    { id:2, date:'2026-09-01', jpy:800,  cat:'교통', note:'' }
  ]);
  eq('마이그레이션이 한 여행을 고침', migrateSpend(), 1);
  var got = tripStore(t.id).get('spend', []);
  eq('금액 보존', got[0].amount, 1200);
  eq('통화 부여', got[0].cur, 'JPY');
  eq('구 필드 제거', got[0].jpy, undefined);
  eq('두 번째 실행은 0건', migrateSpend(), 0);
})();

// ---- 통화 ----
eq('JPY 프리셋', currencyByCode('JPY').symbol, '¥');
eq('JPY는 소수점 없음', currencyByCode('JPY').decimals, 0);
eq('USD는 소수점 둘', currencyByCode('USD').decimals, 2);
eq('VND 단위 1000', currencyByCode('VND').unit, 1000);
eq('모르는 코드는 코드 자체를 기호로', currencyByCode('XYZ').symbol, 'XYZ');
eq('모르는 코드는 소수점 둘', currencyByCode('XYZ').decimals, 2);
eq('기본 통화는 원화', defaultCurrency().code, 'KRW');

eq('엔 표기', fmtAmount(1200, currencyByCode('JPY')), '¥1,200');
eq('달러 표기(소수점 둘)', fmtAmount(12.5, currencyByCode('USD')), '$12.50');
eq('동 표기(소수점 없음)', fmtAmount(120000, currencyByCode('VND')), '₫120,000');
eq('엔은 반올림', fmtAmount(1200.7, currencyByCode('JPY')), '¥1,201');
eq('숫자 아니면 0 취급', fmtAmount('abc', currencyByCode('JPY')), '¥0');

// rates는 1 KRW당 해당 통화다(실측) — 원화 = 금액 / rates[코드]
var RATES = { JPY: 0.111682, USD: 0.000708, VND: 18.53835 };
eq('엔 → 원', toKRW(1200, 'JPY', RATES), 10745);
eq('달러 → 원', toKRW(10, 'USD', RATES), 14124);
eq('원 → 원은 그대로', toKRW(5000, 'KRW', RATES), 5000);
eq('환율 없으면 null', toKRW(100, 'ZZZ', RATES), null);
eq('rates 없으면 null', toKRW(100, 'JPY', null), null);
eq('원화 표기', fmtKRW(10745), '10,745원');

// 통화별 합계 — 한 여행에 여러 통화가 섞일 수 있다
var SL = [
  { id:1, amount:1200, cur:'JPY', cat:'식비', date:'2026-09-01' },
  { id:2, amount:800,  cur:'JPY', cat:'교통', date:'2026-09-01' },
  { id:3, amount:12.5, cur:'USD', cat:'식비', date:'2026-09-02' }
];
eq('통화별 합계', spendTotals(SL), [{ cur:'JPY', amount:2000 }, { cur:'USD', amount:12.5 }]);
eq('빈 목록', spendTotals([]), []);
eq('분류별 집계에 통화 축', spendByCat(SL), [
  { cat:'식비', cur:'JPY', amount:1200 },
  { cat:'식비', cur:'USD', amount:12.5 },
  { cat:'교통', cur:'JPY', amount:800 }
]);

// ---- 환율 ----
eq('FX_URL은 KRW 기준', FX_URL.indexOf('/latest/KRW') >= 0, true);
// 무료 등급 이용 조건상 출처 표기가 필수다.
eq('출처 표기에 링크가 있다', FX_ATTRIB_HTML.indexOf('exchangerate-api.com') >= 0, true);

(function () {
  __resetStorage();
  lsSet('fx', { at:'2026-08-08T00:00:00Z', rates:{ JPY:0.111682, USD:0.000708 } });
  var st = tripStore('t_fx');
  eq('자동 환율을 읽는다', fxRates(st).JPY, 0.111682);
  eq('모르는 통화는 환산 불가', toKRW(100, 'ZZZ', fxRates(st)), null);

  // 수동값은 "1단위당 원화"로 저장한다(9원/엔). rates 축(1원당 통화)으로 뒤집어 얹는다.
  st.set('fxManual', { JPY: 9 });
  eq('수동 환율이 자동보다 우선', Math.round(1 / fxRates(st).JPY), 9);
  eq('수동 환율로 환산', toKRW(1200, 'JPY', fxRates(st)), 10800);
  eq('수동을 안 넣은 통화는 자동값', fxRates(st).USD, 0.000708);

  st.set('fxManual', {});
  eq('수동을 비우면 자동값으로', fxRates(st).JPY, 0.111682);
})();

// ---- 통화 기호 XSS ----
// currency.symbol은 가져온 JSON에서 올 수 있는 외부 입력이다.
(function () {
  var H = '<img src=x onerror=alert(1)>';
  var st = { get: function (k, fb) { return k === 'spend'
    ? [{ id:1, date:'2026-08-08', amount:100, cur:H, cat:'식비', note:'' }] : fb; },
    set: function () {} };
  var el = global.__setDomTarget('summary');
  renderSummary({ id:'t_x', title:'T', start:'2026-08-08', end:'2026-08-09',
                  hotel:'', party:2, budgetKRW:0 }, st);
  eq('요약: 통화 기호로 태그를 주입할 수 없다', el.innerHTML.indexOf('<img src=x') === -1, true);
})();

// ---- 나라 → 통화 ----
eq('일본은 엔', currencyForCountry('JP').code, 'JPY');
eq('베트남은 동', currencyForCountry('VN').code, 'VND');
eq('대만은 대만달러', currencyForCountry('TW').code, 'TWD');
eq('홍콩·마카오 구분', [currencyForCountry('HK').code, currencyForCountry('MO').code], ['HKD', 'MOP']);
eq('유로존은 유로', [currencyForCountry('FR').code, currencyForCountry('DE').code,
  currencyForCountry('IT').code, currencyForCountry('ES').code].join(','), 'EUR,EUR,EUR,EUR');
eq('한국은 원', currencyForCountry('KR').code, 'KRW');
eq('소문자도 받는다', currencyForCountry('jp').code, 'JPY');
// 프리셋에 없는 나라도 통화 코드는 준다 — currencyByCode가 기본 모양을 만들어 준다.
eq('캐나다는 CAD', currencyForCountry('CA').code, 'CAD');
eq('모르는 나라는 null', currencyForCountry('ZZ'), null);
eq('빈 값은 null', currencyForCountry(''), null);

// geoParse가 country_code를 보존해야 통화를 고를 수 있다
eq('geoParse가 국가 코드를 담는다',
  geoParse({ results: [{ name:'다낭', country:'베트남', country_code:'VN',
    latitude:16.06778, longitude:108.22083, timezone:'Asia/Ho_Chi_Minh' }] })[0].cc, 'VN');

// ---- 섹션 편집 ----
eq('본문 → list 변환', sectionBodyFromText('list', '첫 줄\n둘째 줄'), ['첫 줄', '둘째 줄']);
eq('빈 줄은 버린다', sectionBodyFromText('list', 'a\n\n  \nb'), ['a', 'b']);
eq('본문 → text는 그대로', sectionBodyFromText('text', 'a\nb'), 'a\nb');
eq('list → 편집용 텍스트', sectionBodyToText({ type:'list', body:['a','b'] }), 'a\nb');
eq('text → 편집용 텍스트', sectionBodyToText({ type:'text', body:'a\nb' }), 'a\nb');
// 표는 편집 대상이 아니다(읽기 전용) — 편집기가 열리지 않아야 한다.
eq('표는 편집 불가', sectionEditable({ type:'table' }), false);
eq('글·목록은 편집 가능', [sectionEditable({type:'text'}), sectionEditable({type:'list'})], [true, true]);

eq('섹션 폼 검증 통과', validateSectionForm({ title:'팁', icon:'💡', body:'a' }), null);
eq('제목 없으면 거부', validateSectionForm({ title:' ', icon:'💡', body:'a' }), '섹션 제목을 입력하세요.');
eq('본문 없으면 거부', validateSectionForm({ title:'팁', icon:'💡', body:'  ' }), '내용을 입력하세요.');

(function () {
  var trip = { sections: [{ id:'s1', icon:'🚄', title:'기차', type:'table', body:[] }] };
  addSection(trip, { title:'팁', icon:'💡', type:'list', body:'첫 줄\n둘째 줄' });
  eq('섹션 추가', trip.sections.length, 2);
  eq('추가된 섹션 형식', trip.sections[1].type, 'list');
  eq('추가된 본문이 배열로', trip.sections[1].body, ['첫 줄', '둘째 줄']);
  eq('id가 부여됨', trip.sections[1].id.slice(0,2), 's_');

  updateSection(trip, trip.sections[1].id, { title:'꿀팁', icon:'⭐', type:'text', body:'한 줄' });
  eq('수정된 제목', trip.sections[1].title, '꿀팁');
  eq('형식 변경 시 본문도 변환', trip.sections[1].body, '한 줄');

  moveSection(trip, trip.sections[1].id, -1);
  eq('위로 이동', trip.sections.map(function(s){return s.title;}), ['꿀팁', '기차']);
  moveSection(trip, trip.sections[0].id, -1);
  eq('맨 위에서 더 못 올라감', trip.sections[0].title, '꿀팁');

  removeSection(trip, trip.sections[0].id);
  eq('삭제', trip.sections.map(function(s){return s.title;}), ['기차']);
  eq('없는 id 삭제는 무해', removeSection(trip, 'nope').sections.length, 1);
})();

// ---- 가져오기 검증 ----
// 검증: 정상
var GOOD = { schema:1, title:'다낭', start:'2026-09-01', end:'2026-09-03', party:2,
  place:null, currency:{code:'VND',symbol:'₫',decimals:0,unit:1000}, hotel:'', budgetKRW:0,
  days:[{n:1,date:'2026-09-01',theme:'',place:null,curCode:null,items:[],meals:[]}],
  sections:[], packing:[], expenses:[] };
eq('정상 데이터는 통과', validateImport(GOOD), null);

eq('객체가 아니면 거부', validateImport(null), '여행 파일이 아닙니다.');
eq('배열도 거부', validateImport([]), '여행 파일이 아닙니다.');
eq('제목 없으면 거부', validateImport(Object.assign({}, GOOD, { title:'' })),
  '제목이 없습니다.');
eq('날짜 형식 거부', validateImport(Object.assign({}, GOOD, { start:'2026/09/01' })),
  '날짜 형식이 올바르지 않습니다.');
eq('종료가 시작보다 빠르면 거부', validateImport(Object.assign({}, GOOD, { end:'2026-08-01' })),
  '종료일이 시작일보다 빠릅니다.');
eq('days가 배열이 아니면 거부', validateImport(Object.assign({}, GOOD, { days:'x' })),
  '일정 데이터가 올바르지 않습니다.');
eq('일차가 너무 많으면 거부',
  validateImport(Object.assign({}, GOOD, { days: new Array(400).fill({n:1,date:'2026-09-01'}) })),
  '일정이 너무 많습니다.');
eq('스키마 버전이 미래면 거부', validateImport(Object.assign({}, GOOD, { schema: 99 })),
  '더 새로운 버전에서 만든 파일입니다.');

// 정규화: 빠진 필드를 채우고 새 id를 준다
(function () {
  var t = normalizeImport({ schema:1, title:'다낭', start:'2026-09-01', end:'2026-09-02' });
  eq('새 id 부여', t.id.slice(0,2), 't_');
  eq('일차 자동 생성', t.days.length, 2);
  eq('빠진 배열 채움', [t.sections, t.packing, t.expenses], [[], [], []]);
  eq('통화 기본값', t.currency.code, 'KRW');
  eq('스키마 버전', t.schema, 1);

  // 악의적인 값이 있어도 구조만 받아들인다 — 렌더는 escHtml이 막지만
  // 저장 단계에서도 타입을 맞춰 둔다.
  var bad = normalizeImport({ schema:1, title:'x', start:'2026-09-01', end:'2026-09-01',
    party:'많이', budgetKRW:'무한', days:[{ n:1, date:'2026-09-01', items:'x' }] });
  eq('인원은 숫자로', bad.party, 2);
  eq('예산은 숫자로', bad.budgetKRW, 0);
  eq('items는 배열로', bad.days[0].items, []);
})();

// 같은 파일을 두 번 가져와도 id가 겹치지 않는다
eq('가져올 때마다 새 id',
  normalizeImport({ schema:1, title:'a', start:'2026-09-01', end:'2026-09-01' }).id ===
  normalizeImport({ schema:1, title:'a', start:'2026-09-01', end:'2026-09-01' }).id, false);

// ---- 일차 메모 (뭐먹지 대체) ----
(function () {
  var day = { n: 1, date: '2026-09-01', notes: [] };
  addNote(day, '스시 맛집 예약함');
  addNote(day, '우산 챙기기');
  eq('메모 추가', day.notes.map(function (n) { return n.text; }), ['스시 맛집 예약함', '우산 챙기기']);
  eq('메모에 id 부여', day.notes[0].id.slice(0,2), 'n_');
  eq('빈 메모는 안 들어감', addNote(day, '   ').notes.length, 2);

  updateNote(day, day.notes[0].id, '스시 맛집 취소');
  eq('메모 수정', day.notes[0].text, '스시 맛집 취소');
  eq('빈 값으로는 안 바뀜', updateNote(day, day.notes[0].id, ' ').notes[0].text, '스시 맛집 취소');

  removeNote(day, day.notes[0].id);
  eq('메모 삭제', day.notes.map(function (n) { return n.text; }), ['우산 챙기기']);
  eq('없는 id 삭제는 무해', removeNote(day, 'nope').notes.length, 1);

  // notes가 없거나 배열이 아닌 손상된 day도 던지지 않는다
  eq('notes 없어도 추가됨', addNote({ n: 2 }, 'a').notes.length, 1);
  eq('배열 아니어도 보정', addNote({ n: 3, notes: 'x' }, 'a').notes.length, 1);
})();

// 마이그레이션: meals(뭐먹지) + 저장된 메모 텍스트 → notes
(function () {
  __resetStorage();
  var t = emptyTrip({ title:'테스트', start:'2026-09-01', end:'2026-09-02' });
  t.days[0].meals = ['점심 뭐먹지', '저녁 뭐먹지'];
  t.days[1].meals = ['아침 뭐먹지'];
  saveTrip(t);
  var st = tripStore(t.id);
  // 사용자가 실제로 써 둔 답 — 이게 유실되면 안 된다
  st.set('meal:2026-09-01:0', '이치란 라멘');
  st.set('meal:2026-09-02:0', '');

  eq('마이그레이션이 한 여행을 고침', migrateMeals(), 1);
  var d = loadTrip(t.id).days;
  eq('사용자가 쓴 메모가 살아남음', d[0].notes[0].text, '이치란 라멘');
  eq('안 쓴 항목은 원래 문구가 메모로', d[0].notes[1].text, '저녁 뭐먹지');
  eq('빈 답이면 원래 문구', d[1].notes[0].text, '아침 뭐먹지');
  eq('meals는 비워짐', d[0].meals, []);
  eq('구 메모 키 제거', lsGet(tripKey(t.id, 'meal:2026-09-01:0'), 'gone'), 'gone');
  eq('두 번째 실행은 0건', migrateMeals(), 0);
})();

// ---- 출발 전 결제 내역 편집 ----
(function () {
  var trip = { expenses: [] };
  addExpense(trip, { date:'2026-08-01', cat:'항공', detail:'왕복 2인', pay:'신한카드', krw:'640000', note:'' });
  eq('내역 추가', trip.expenses.length, 1);
  eq('금액은 숫자로', trip.expenses[0].krw, 640000);
  eq('id 부여', trip.expenses[0].id.slice(0,2), 'e_');

  addExpense(trip, { date:'2026-08-02', cat:'숙소', detail:'6박', pay:'', krw:'900000' });
  eq('두 건', trip.expenses.length, 2);

  updateExpense(trip, trip.expenses[0].id, { date:'2026-08-01', cat:'항공권', detail:'왕복 2인',
    pay:'신한카드', krw:'650000', note:'마일리지' });
  eq('수정된 분류', trip.expenses[0].cat, '항공권');
  eq('수정된 금액', trip.expenses[0].krw, 650000);
  eq('수정된 메모', trip.expenses[0].note, '마일리지');

  removeExpense(trip, trip.expenses[0].id);
  eq('삭제', trip.expenses.map(function (e) { return e.cat; }), ['숙소']);
  eq('없는 id 삭제는 무해', removeExpense(trip, 'nope').expenses.length, 1);

  // expenses가 없거나 배열이 아닌 손상된 trip도 안전
  eq('expenses 없어도 추가됨', addExpense({}, { cat:'x', krw:'1' }).expenses.length, 1);
  eq('배열 아니어도 보정', addExpense({ expenses:'x' }, { cat:'y', krw:'1' }).expenses.length, 1);
})();

eq('내역 폼 검증 통과', validateExpenseForm({ cat:'항공', krw:'1000' }), null);
eq('분류 없으면 거부', validateExpenseForm({ cat:' ', krw:'1000' }), '항목을 입력하세요.');
eq('금액 0은 거부', validateExpenseForm({ cat:'항공', krw:'0' }), '금액을 입력하세요.');
eq('금액이 숫자가 아니면 거부', validateExpenseForm({ cat:'항공', krw:'abc' }), '금액을 입력하세요.');
eq('음수 거부', validateExpenseForm({ cat:'항공', krw:'-5' }), '금액을 입력하세요.');

// 구 레코드에는 id가 없다 — 편집하려면 id가 있어야 하므로 부여한다
(function () {
  __resetStorage();
  var t = emptyTrip({ title:'x', start:'2026-09-01', end:'2026-09-02' });
  t.expenses = [{ date:'2026-08-01', cat:'항공', detail:'', pay:'', krw:640000, note:'' }];
  saveTrip(t);
  eq('id 마이그레이션 1건', migrateExpenseIds(), 1);
  eq('id가 생김', loadTrip(t.id).expenses[0].id.slice(0,2), 'e_');
  eq('금액은 그대로', loadTrip(t.id).expenses[0].krw, 640000);
  eq('두 번째 실행은 0건', migrateExpenseIds(), 0);
})();

// ---- 나라 목록 (새 여행에서 나라 → 통화) ----
eq('나라 목록이 비어있지 않음', COUNTRIES.length > 30, true);
eq('나라 항목 모양', Object.keys(countryByCode('JP')).sort().join(','), 'cc,cur,name');
eq('일본', countryByCode('JP').name, '일본');
eq('일본 통화', countryByCode('JP').cur, 'JPY');
eq('베트남 통화', countryByCode('VN').cur, 'VND');
eq('프랑스는 유로', countryByCode('FR').cur, 'EUR');
eq('소문자도 받음', countryByCode('jp').name, '일본');
eq('모르는 코드는 null', countryByCode('ZZ'), null);
// 목록의 모든 나라는 통화 표에 있어야 한다 — 고르면 통화가 반드시 따라와야 하므로.
eq('모든 나라에 통화가 있다',
  COUNTRIES.filter(function (c) { return !COUNTRY_CURRENCY[c.cc]; }).length, 0);
eq('나라 목록은 가나다순',
  COUNTRIES.map(function (c) { return c.name; }).join('|') ===
  COUNTRIES.map(function (c) { return c.name; }).slice().sort(function(a,b){return a.localeCompare(b,'ko');}).join('|'), true);

// ---- 나라별 도시 목록 ----
eq('도시 목록이 있다', typeof CITIES === 'object' && CITIES !== null, true);
eq('일본 도시가 여럿', citiesOf('JP').length > 3, true);
eq('도시 항목 모양', Object.keys(citiesOf('JP')[0]).sort().join(','), 'lat,lon,name,tz');
eq('소문자 나라코드도 받는다', citiesOf('jp').length > 0, true);
eq('모르는 나라는 빈 배열', citiesOf('ZZ'), []);
eq('빈 값도 빈 배열', citiesOf(''), []);
// 목록에서 고른 도시는 곧바로 place로 쓸 수 있어야 한다(좌표·시간대가 있어야 날씨가 온다).
eq('모든 도시에 좌표와 시간대',
  Object.keys(CITIES).every(function (cc) {
    return CITIES[cc].every(function (c) {
      return typeof c.name === 'string' && isFinite(c.lat) && isFinite(c.lon) && !!c.tz;
    });
  }), true);
// 도시를 고르면 나라 코드가 함께 붙어야 통화 자동 선택이 이어진다.
eq('cityToPlace가 나라 코드를 붙인다',
  cityToPlace({ name:'오사카 시', lat:34.69, lon:135.5, tz:'Asia/Tokyo' }, 'JP').cc, 'JP');
eq('cityToPlace 좌표 보존', cityToPlace({ name:'a', lat:1, lon:2, tz:'X' }, 'JP').lat, 1);
eq('cityToPlace 국가명도 붙인다', cityToPlace({ name:'a', lat:1, lon:2, tz:'X' }, 'JP').country, '일본');
eq('cityToPlace null 안전', cityToPlace(null, 'JP'), null);

// ---- 기간 라벨 ----
// 여행 설정 폼이 날짜를 고치는 즉시 "몇 박 몇 일"을 보여준다. 요약 헤더와 같은
// 문구를 써야 폼에서 본 것과 저장 후 본 것이 어긋나지 않는다.
eq('기간 라벨: 2박 3일', nightsLabel('2026-08-10', '2026-08-12'), '2박 3일');
eq('기간 라벨: 6박 7일', nightsLabel('2026-07-28', '2026-08-03'), '6박 7일');
eq('기간 라벨: 같은 날은 당일치기', nightsLabel('2026-08-10', '2026-08-10'), '당일치기');
eq('기간 라벨: 종료가 시작보다 빠르면 빈 문자열', nightsLabel('2026-08-12', '2026-08-10'), '');
eq('기간 라벨: 비어 있으면 빈 문자열', nightsLabel('', '2026-08-10'), '');
eq('기간 라벨: 날짜가 아니면 빈 문자열', nightsLabel('어제', '2026-08-10'), '');

// ---- 일차별 숙소 ----
// 숙소는 여행 중에 옮길 수 있다(오사카 3박 → 교토 2박). day.place와 같은 상속 규칙을
// 쓴다: 일차에 값이 있으면 그것, 없으면 여행 기본 숙소.
(function () {
  var trip = emptyTrip({ title: '간사이', start: '2026-08-10', end: '2026-08-12',
                         party: 2, hotel: '오사카 호텔' });
  eq('새 일차의 숙소는 비어 있다', trip.days[0].hotel, null);
  eq('일차 숙소가 없으면 여행 기본 숙소', dayHotel(trip, trip.days[0]), '오사카 호텔');

  setDayHotel(trip, 3, '교토 료칸\n체크인 15시');
  eq('setDayHotel이 그 일차에만 붙는다', trip.days[2].hotel, '교토 료칸\n체크인 15시');
  eq('지정한 일차는 그 숙소', dayHotel(trip, trip.days[2]), '교토 료칸\n체크인 15시');
  eq('다른 일차는 그대로 기본값', dayHotel(trip, trip.days[1]), '오사카 호텔');

  // 빈 문자열은 "기본값으로 되돌리기"다 — 빈 숙소를 저장해두면 기본값이 가려진다.
  setDayHotel(trip, 3, '   ');
  eq('빈 값을 넣으면 오버라이드가 지워진다', trip.days[2].hotel, null);
  eq('지워지면 다시 기본값 상속', dayHotel(trip, trip.days[2]), '오사카 호텔');

  eq('없는 일차는 조용히 무시', setDayHotel(trip, 99, '아무거나'), false);
  eq('기본 숙소도 없으면 빈 문자열', dayHotel({ hotel: '' }, { hotel: null }), '');
})();

// 손상된 저장값(가져온 JSON)에서 day.hotel이 문자열이 아닐 수 있다 — 렌더가
// itemLinesHtml에 넘기므로 문자열/null로 맞춘다.
(function () {
  var d = normalizeDay({ n: 1, date: '2026-08-10', items: [], meals: [], notes: [], hotel: 42 });
  eq('normalizeDay: 숫자 숙소는 문자열로 보정', d.hotel, '42');
  eq('normalizeDay: 없는 숙소는 null', normalizeDay({ n: 1, date: '', items: [] }).hotel, null);
})();

// 숙소 탭은 여행 기본 + 일차별 목록을 함께 보여준다. 외부 입력(가져온 JSON)이
// 그대로 들어오므로 이스케이프를 지킨다.
(function () {
  var trip = emptyTrip({ title: '간사이', start: '2026-08-10', end: '2026-08-11',
                         party: 2, hotel: '오사카 호텔\n체크인 15시' });
  setDayHotel(trip, 2, '<img src=x onerror=alert(1)>');
  var html = panelHtml(trip, 'hotel');
  eq('숙소 탭: 기본 숙소가 보인다', html.indexOf('오사카 호텔') >= 0, true);
  eq('숙소 탭: 여러 줄 숙소는 줄 단위로 그린다',
    html.indexOf('<div class="line">체크인 15시</div>') >= 0, true);
  eq('숙소 탭: 일차별 줄이 일수만큼 있다',
    (html.match(/hr-day/g) || []).length, 2);
  eq('숙소 탭: 악의적인 일차 숙소는 이스케이프됨', html.indexOf('<img src=x') === -1, true);
  eq('숙소 탭: 기본값을 쓰는 일차는 그렇다고 알려준다',
    html.indexOf('기본 숙소와 같음') >= 0, true);
  eq('숙소 탭: 기본 숙소가 없어도 일차별 목록은 나온다',
    panelHtml(emptyTrip({ title: 'x', start: '2026-08-10', end: '2026-08-10',
                          party: 1, hotel: '' }), 'hotel').indexOf('hr-day') >= 0, true);
})();

// ---- 일차별 경비 ----
// 여행 중에는 "오늘 얼마 썼나"를 그날 화면에서 바로 보고 바로 적을 수 있어야 한다.
// 경비 탭의 기록과 같은 저장소(trip:<id>:spend)를 쓰되, 일차 카드에서 넣는 기록은
// 오늘이 아니라 그 일차의 날짜로 붙는다(지난 날의 지출을 나중에 적을 수 있어야 한다).
(function () {
  var mem = {};
  var st = {
    get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
    set: function (k, v) { mem[k] = v; }
  };

  var a = spendAdd(st, { date: '2026-08-10', amount: 50000, cur: 'VND', cat: '식비', note: '퍼' });
  var b = spendAdd(st, { date: '2026-08-11', amount: 30000, cur: 'VND', cat: '교통', note: '택시' });
  eq('경비 추가는 id를 붙여 돌려준다', typeof a.id === 'number', true);
  eq('id는 서로 다르다', a.id === b.id, false);
  eq('저장소에 쌓인다', spendList(st).length, 2);

  eq('그날 것만 고른다', daySpend(st, '2026-08-10').length, 1);
  eq('그날 것의 내용', daySpend(st, '2026-08-10')[0].note, '퍼');
  eq('기록 없는 날은 빈 배열', daySpend(st, '2026-08-12'), []);
  eq('날짜가 없으면 빈 배열', daySpend(st, ''), []);

  spendUpdate(st, a.id, { amount: 60000, cur: 'VND', cat: '식비', note: '퍼 곱빼기' });
  eq('수정은 그 기록만 바꾼다', daySpend(st, '2026-08-10')[0].amount, 60000);
  eq('수정해도 날짜는 그대로', daySpend(st, '2026-08-10')[0].date, '2026-08-10');
  eq('없는 id 수정은 무해', spendUpdate(st, 999999, { amount: 1 }), false);

  spendRemove(st, a.id);
  eq('삭제하면 그날에서 사라진다', daySpend(st, '2026-08-10'), []);
  eq('다른 날은 그대로', daySpend(st, '2026-08-11').length, 1);
  eq('전체 목록에서도 사라진다', spendList(st).length, 1);
})();

// 일차 카드의 경비 블록: 그날 합계와 목록, 추가 버튼. 분류·내용은 외부 입력이므로
// 이스케이프를 지킨다.
(function () {
  var mem = {};
  var st = {
    get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
    set: function (k, v) { mem[k] = v; }
  };
  var day = { n: 1, date: '2026-08-10', theme: '', items: [], meals: [], notes: [] };
  var trip = { days: [day], hotel: '', currency: { code: 'VND', symbol: '₫', decimals: 0, unit: 1000 } };

  var el = global.__setDomTarget('timeline');
  renderTimeline(trip, day, st);
  eq('경비 버튼은 늘 보인다', el.innerHTML.indexOf('class="day-spend"') >= 0, true);
  eq('기록이 없으면 배지도 없다', el.innerHTML.indexOf('sbadge') === -1, true);
  eq('목록은 비었다고 알린다',
    daySpendListHtml(st, '2026-08-10').indexOf('아직 기록이 없습니다') >= 0, true);
  eq('추가 버튼은 목록 안에 있다',
    daySpendListHtml(st, '2026-08-10').indexOf('class="dsp-add"') >= 0, true);

  spendAdd(st, { date: '2026-08-10', amount: 50000, cur: 'VND', cat: '식비',
                 note: '<img src=x onerror=alert(1)>' });
  spendAdd(st, { date: '2026-08-10', amount: 20000, cur: 'VND', cat: '교통', note: '택시' });
  spendAdd(st, { date: '2026-08-11', amount: 99000, cur: 'VND', cat: '쇼핑', note: '다른 날' });

  // 카드에는 합계만 배지로 — 목록은 모달에서 본다.
  var el2 = global.__setDomTarget('timeline');
  renderTimeline(trip, day, st);
  eq('버튼 배지에 그날 합계', el2.innerHTML.indexOf('<span class="sbadge">₫70,000</span>') >= 0, true);
  eq('카드에 목록은 붙지 않는다', el2.innerHTML.indexOf('dsp-r') === -1, true);

  var html = daySpendListHtml(st, '2026-08-10');
  eq('그날 기록만 줄로 나온다', (html.match(/class="dsp-r"/g) || []).length, 2);
  eq('다른 날 기록은 섞이지 않는다', html.indexOf('다른 날') === -1, true);
  eq('목록 위에 합계를 보여준다', html.indexOf('₫70,000') >= 0, true);
  eq('악의적인 내용은 이스케이프됨', html.indexOf('<img') === -1, true);

  // 통화가 섞이면 버튼에는 금액 대신 개수만 — 버튼 한 줄에 다 담을 수 없다.
  spendAdd(st, { date: '2026-08-10', amount: 12.5, cur: 'USD', cat: '교통', note: '그랩' });
  eq('통화가 여럿이면 개수 배지', daySpendBadge(st, '2026-08-10'), '2개 통화');
  eq('기록 없는 날은 배지 없음', daySpendBadge(st, '2026-08-12'), '');
})();

// ---- 준비물 ----
// 기본 목록(trip.packing)과 사용자가 더한 것(packing_add)을 한 목록으로 합치고,
// 체크 상태(packing_checked)를 붙인다. 삭제는 사용자가 더한 것만 된다.
(function () {
  var mem = { packing_add: ['멀미약', '우산'], packing_checked: { '여권': true, '멀미약': true } };
  var st = {
    get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
    set: function (k, v) { mem[k] = v; }
  };
  var trip = { packing: ['여권', '유심'] };
  var items = packingItems(trip, st);
  eq('기본 + 추가를 한 목록으로', items.map(function (i) { return i.text; }),
    ['여권', '유심', '멀미약', '우산']);
  eq('기본 항목은 지울 수 없다', items[0].custom, false);
  eq('더한 항목은 지울 수 있다', items[2].custom, true);
  eq('체크 상태가 붙는다', items.map(function (i) { return i.done; }),
    [true, false, true, false]);

  eq('진행 상황', packingProgress(items), { done: 2, total: 4 });
  eq('빈 목록의 진행 상황', packingProgress([]), { done: 0, total: 0 });

  // 준비물은 몰아서 적는 일이 잦다 — 줄 단위로 나눠 한 번에 넣는다.
  eq('여러 줄을 한 번에', packingAddLines(' 우비 \n\n 보조배터리 \n'), ['우비', '보조배터리']);
  eq('빈 입력은 빈 배열', packingAddLines('   \n \n'), []);
  eq('같은 줄이 겹치면 하나만', packingAddLines('우비\n우비'), ['우비']);
})();

// 준비물 목록 HTML: 체크 상태·삭제 버튼·이스케이프.
(function () {
  var mem = { packing_add: ['<img src=x onerror=alert(1)>'], packing_checked: { '여권': true } };
  var st = {
    get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
    set: function (k, v) { mem[k] = v; }
  };
  var html = packingListHtml({ packing: ['여권', '유심'] }, st);
  eq('줄 수는 항목 수와 같다', (html.match(/class="pk-r/g) || []).length, 3);
  eq('체크된 항목에 표시가 붙는다', html.indexOf('pk-r done') >= 0, true);
  eq('기본 항목에는 삭제 버튼이 없다', (html.match(/class="pack-del"/g) || []).length, 1);
  eq('악의적인 항목명은 이스케이프됨', html.indexOf('<img src=x') === -1, true);
  eq('진행 표시', html.indexOf('1 / 3') >= 0, true);
  eq('추가 버튼은 늘 보인다', html.indexOf('class="pack-add-btn"') >= 0, true);
  eq('아무것도 없으면 안내',
    packingListHtml({ packing: [] }, { get: function (k, fb) { return fb; }, set: function () {} })
      .indexOf('아직 준비물이 없습니다') >= 0, true);
})();

// ---- 나라 정보 ----
// 시차는 표에 적지 않고 시간대(tz)로 계산한다 — 서머타임이 있는 나라는 계절에 따라
// 달라지므로 적어 두면 반드시 틀린다.
(function () {
  var 여름 = new Date('2026-07-15T00:00:00Z');
  var 겨울 = new Date('2026-01-15T00:00:00Z');
  eq('한국은 같음', tzDiffLabel('Asia/Seoul', 여름), '한국과 같음');
  eq('일본도 같음', tzDiffLabel('Asia/Tokyo', 여름), '한국과 같음');
  eq('베트남은 2시간 느림', tzDiffLabel('Asia/Ho_Chi_Minh', 여름), '한국보다 2시간 느림');
  eq('네팔은 3시간 15분 느림', tzDiffLabel('Asia/Kathmandu', 여름), '한국보다 3시간 15분 느림');
  eq('시드니는 겨울에 2시간 빠름', tzDiffLabel('Australia/Sydney', 겨울), '한국보다 2시간 빠름');
  eq('시드니는 여름에 1시간 빠름', tzDiffLabel('Australia/Sydney', 여름), '한국보다 1시간 빠름');
  // 서머타임: 파리는 겨울 -8, 여름 -7.
  eq('파리 겨울', tzDiffLabel('Europe/Paris', 겨울), '한국보다 8시간 느림');
  eq('파리 여름', tzDiffLabel('Europe/Paris', 여름), '한국보다 7시간 느림');
  eq('모르는 시간대는 빈 문자열', tzDiffLabel('Nowhere/Nothing', 여름), '');
  eq('빈 값도 빈 문자열', tzDiffLabel('', 여름), '');
})();

eq('나라 정보 표가 있다', typeof COUNTRY_INFO === 'object' && COUNTRY_INFO !== null, true);
eq('베트남 정보', countryInfo('VN').emg.indexOf('113') >= 0, true);
eq('소문자 나라코드도 받는다', countryInfo('jp') !== null, true);
eq('모르는 나라는 null', countryInfo('ZZ'), null);
eq('빈 값도 null', countryInfo(''), null);
// 표에 적은 나라는 모두 같은 모양이어야 한다 — 한 필드라도 비면 그 줄이 사라진다.
eq('모든 나라에 전압·플러그·긴급전화',
  Object.keys(COUNTRY_INFO).every(function (cc) {
    var i = COUNTRY_INFO[cc];
    return !!i.volt && !!i.plug && !!i.emg && !!i.tip && !!i.water;
  }), true);
// cities.js에 있는 나라는 정보도 있어야 한다(도시를 고를 수 있는데 정보가 없으면 빈다).
eq('도시가 있는 나라는 정보도 있다',
  Object.keys(CITIES).filter(function (cc) { return !COUNTRY_INFO[cc]; }), []);

// 정보 탭의 나라 카드
(function () {
  var trip = { countryCode: 'VN', place: { name: '다낭', tz: 'Asia/Ho_Chi_Minh' },
               currency: { code: 'VND', symbol: '₫', decimals: 0, unit: 1000 },
               sections: [], days: [] };
  var html = panelHtml(trip, 'info');
  eq('나라 이름이 보인다', html.indexOf('베트남') >= 0, true);
  eq('전압이 보인다', html.indexOf('220V') >= 0, true);
  eq('긴급 전화가 보인다', html.indexOf('113') >= 0, true);
  eq('시차가 보인다', html.indexOf('한국보다 2시간 느림') >= 0, true);
  eq('통화가 보인다', html.indexOf('VND') >= 0, true);
  // 비자·입국은 적지 않고 외교부로 보낸다 — 자주 바뀌는 정보를 구워 두면 안 된다.
  eq('비자는 외교부로 안내', html.indexOf('0404.go.kr') >= 0, true);

  // 나라를 안 고른 여행에는 카드가 없다(빈 카드를 내지 않는다).
  eq('나라 없으면 카드도 없다',
    panelHtml({ sections: [], days: [] }, 'info').indexOf('class="ci"') === -1, true);
  // 표에 없는 나라도 카드를 내지 않는다.
  eq('모르는 나라도 카드 없음',
    panelHtml({ countryCode: 'ZZ', sections: [], days: [] }, 'info').indexOf('class="ci"') === -1, true);
})();

// ---- 동행자 공유 (링크) ----
// 서버가 없으므로 여행 데이터를 링크 자체에 담는다. '#' 뒤(fragment)는 서버로
// 전송되지 않으므로 GitHub Pages도 그 내용을 보지 못한다.
(function () {
  // base64url: 링크에 그대로 실을 수 있게 +/= 를 -_ 로 바꾸고 패딩을 뗀다.
  var bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
  var enc = b64urlEncode(bytes);
  eq('base64url에는 +/= 가 없다', /^[A-Za-z0-9_-]*$/.test(enc), true);
  eq('바이트 왕복', Array.prototype.slice.call(b64urlDecode(enc)),
    Array.prototype.slice.call(bytes));
  eq('빈 바이트열', b64urlDecode(b64urlEncode(new Uint8Array([]))).length, 0);
  eq('잘못된 문자열은 null', b64urlDecode('!!!not base64!!!'), null);

  // 압축 없이 담는 경로(CompressionStream이 없는 환경). 마커 '0'으로 구분한다.
  var json = JSON.stringify({ title: '베트남 여행', note: '한글도 담긴다 · ¥€₫' });
  var packed = packShareSync(json);
  eq('압축 없는 페이로드는 0으로 시작', packed.charAt(0), '0');
  eq('한글·기호 왕복', unpackShareSync(packed), json);
  eq('망가진 페이로드는 null', unpackShareSync('0!!!'), null);
  eq('모르는 마커는 null', unpackShareSync('9abc'), null);
  eq('빈 문자열은 null', unpackShareSync(''), null);

  // 링크 모양
  eq('공유 해시', shareHash('0abc'), '#/s/0abc');
  eq('해시에서 페이로드 뽑기', parseShareHash('#/s/0abc'), '0abc');
  eq('다른 해시는 null', parseShareHash('#/t/t_a/money'), null);
  eq('페이로드가 없으면 null', parseShareHash('#/s/'), null);
  // 링크 주소는 현재 페이지에서 해시만 갈아 끼운다 — 배포 경로(/osaka-trip/)가 유지된다.
  eq('공유 주소', shareUrl('https://x.dev/osaka-trip/index.html#/t/t_a/money', '0abc'),
    'https://x.dev/osaka-trip/#/s/0abc');
  // index.html이 아닌 파일명은 그대로 둔다 — 떼면 그 주소로는 앱이 열리지 않는다.
  eq('공유 주소(쿼리 있음)', shareUrl('https://x.dev/a/b.html?q=1#/x', '0z'),
    'https://x.dev/a/b.html#/s/0z');
})();

// 공유로 받은 여행은 가져오기와 같은 검증을 거친다 — 남이 보낸 링크도 결국 외부 입력이다.
(function () {
  __resetStorage();
  var trip = { schema: 1, title: '공유받은 여행', start: '2026-09-01', end: '2026-09-02',
               party: 2, days: [] };
  var payload = packShareSync(JSON.stringify(trip));
  var res = importShare(payload);
  eq('공유 링크로 담기', res.error, null);
  eq('담긴 여행 제목', res.trip.title, '공유받은 여행');
  eq('저장소에도 들어간다', listTrips().length, 1);
  // 링크로 받을 때마다 새 여행이 된다 — 내 것을 덮어쓰지 않는다.
  eq('두 번 담으면 두 개', (importShare(payload), listTrips().length), 2);
  eq('id가 새로 생긴다', loadTrip(listTrips()[0].id).id === loadTrip(listTrips()[1].id).id, false);

  eq('망가진 링크', importShare('0!!!').error, '공유 링크를 읽을 수 없습니다.');
  eq('여행이 아닌 데이터', importShare(packShareSync('{"a":1}')).error, '제목이 없습니다.');
})();

// ---- 경비: 원화 환산 표시 ----
// 현지 통화만 보고는 얼마를 쓴 건지 감이 안 온다 — 기록마다, 합계마다 원화를 함께 낸다.
// 환율이 아직 없으면(오프라인 첫 실행) 그 자리는 그냥 비운다. 오류 문구를 넣지 않는다.
(function () {
  var mem = { fx: null };
  var st = {
    get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
    set: function (k, v) { mem[k] = v; }
  };
  // 1원당 통화 — open.er-api.com의 KRW 기준 응답과 같은 축이다.
  lsSet('fx', { at: 'x', fetchedAt: Date.now(), rates: { VND: 18.531034, USD: 0.000708 } });

  spendAdd(st, { date: '2026-08-10', amount: 50000, cur: 'VND', cat: '식비', note: '반미' });
  var html = daySpendListHtml(st, '2026-08-10');
  eq('기록 줄에 원화가 함께 나온다', html.indexOf('2,698원') >= 0, true);
  eq('합계에도 원화', (html.match(/2,698원/g) || []).length, 2);

  // 환율을 모르는 통화는 원화 자리를 비운다(틀린 숫자를 내느니 안 내는 게 낫다).
  spendAdd(st, { date: '2026-08-11', amount: 100, cur: 'ZZZ', cat: '기타', note: '?' });
  var h2 = daySpendListHtml(st, '2026-08-11');
  eq('모르는 통화는 원화를 내지 않는다', h2.indexOf('원</span>') === -1, true);

  // 환율 자체가 없으면(첫 실행·오프라인) 전부 통화만 나온다.
  lsDel('fx');
  var h3 = daySpendListHtml(st, '2026-08-10');
  eq('환율이 없으면 통화만', h3.indexOf('원') === -1, true);
  eq('그래도 금액은 나온다', h3.indexOf('50,000') >= 0, true);
})();

// 경비 탭의 현지 경비는 읽기 전용이다 — 입력은 일차 카드에서 한다.
(function () {
  __resetStorage();
  var mem = {};
  var st = {
    get: function (k, fb) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : fb; },
    set: function (k, v) { mem[k] = v; }
  };
  spendAdd(st, { date: '2026-08-10', amount: 50000, cur: 'VND', cat: '식비', note: '반미' });
  var trip = { id: 't_x', days: [{ n: 1, date: '2026-08-10' }],
               currency: { code: 'VND', symbol: '₫', decimals: 0, unit: 1000 } };
  var el = global.__setDomTarget('spend-body');
  renderSpend(trip, st);
  var html = el.innerHTML;
  eq('입력 폼은 없다', html.indexOf('class="spend-add"') === -1, true);
  eq('줄마다 붙던 삭제 버튼도 없다', html.indexOf('spend-del') === -1, true);
  eq('날짜별 기록은 그대로 보인다', html.indexOf('2026-08-10') >= 0, true);
  eq('금액도 보인다', html.indexOf('50,000') >= 0, true);
  eq('어디서 넣는지 알려 준다', html.indexOf('일정 탭') >= 0, true);
  // 환율 입력은 남는다 — 경비 입력이 아니라 환산 설정이다.
  eq('환율 줄은 남는다', html.indexOf('class="sfx"') >= 0, true);
})();
