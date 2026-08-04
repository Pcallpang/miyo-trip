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
