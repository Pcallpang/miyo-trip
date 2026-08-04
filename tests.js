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
eq('식사 메모 이관', tripStore(mid).get('meal:2:0', ''), '구시카츠 다루마');
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
eq('escHtml 기본', escHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
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
