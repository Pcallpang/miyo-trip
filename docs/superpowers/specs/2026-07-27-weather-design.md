# 오사카 날씨 표시 기능 설계

날짜: 2026-07-27
대상: `C:\Pcall\Trip` (오사카 여행 PWA, https://pcallpang.github.io/osaka-trip/)

## 요구사항

- 매일 오사카 날씨를 앱에서 확인 (사용자 요청)
- 수준: **오늘 날씨 + 주간(일차별) 예보** (브레인스토밍 확정)

## 데이터

**Open-Meteo 예보 API** — 키·가입 불요, CORS 허용, 무료.

```
https://api.open-meteo.com/v1/forecast?latitude=34.69&longitude=135.5
  &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max
  &timezone=Asia%2FTokyo&forecast_days=7
```

- 좌표는 오사카 시내 고정. 위치 감지 없음.
- `timezone=Asia/Tokyo` — 일자 구분이 여행 일정 날짜와 일치.
- 7일 예보로 여행 기간(07-28~08-03) 커버. 오늘이 7/27이면 8/2까지 — 마지막 1일은
  여행 중 갱신되면 자연히 채워진다.

## 화면

1. **상단 요약** — 호텔 줄 아래: `🌤️ 오늘 32° / 26° · 비 40%`
2. **일차 카드 머리(dayhead)** — 테마 줄 아래 같은 형식 (그날 예보, "오늘" 접두어 없음)
3. 예보에 없는 날짜는 **그 줄 자체를 생략** (에러 문구 없음)
4. 강수확률이 null이면 `· 비 n%` 부분 생략

WMO weather_code → 이모지+한글: 0 ☀️맑음 / 1-2 🌤️구름 조금 / 3 ☁️흐림 /
45·48 🌫️안개 / 51-57 🌦️이슬비 / 61-67 🌧️비 / 71-77·85-86 🌨️눈 /
80-82 🌧️소나기 / 95+ ⛈️뇌우 / 그 외 🌡️.

## 갱신·오프라인

- 앱 로드마다 fetch 시도. 성공하면 `store` 키 `weather`에
  `{ at: ISO문자열, api: 응답 }` 저장 후 화면 갱신.
- fetch 실패(오프라인 등) 시 저장된 마지막 예보를 표시하되
  **`(7/27 08:30 기준)` 스탬프를 붙인다.** 성공 시 스탬프 없음.
- 저장된 것도 없으면 날씨 줄 자체를 표시하지 않는다.
- fetch는 비동기 — 최초 렌더는 캐시(있으면)로 그리고, 응답 도착 시
  상단 요약과 현재 선택된 일차만 다시 그린다.

## 범위 밖 (YAGNI)

시간별 그래프, 다른 도시, 위치 감지, 강수 알림, 수동 새로고침 버튼.

## 영향 범위

| 파일 | 변경 |
|---|---|
| `app.js` | `wxIcon`/`wxDailyMap`/`wxLine` 순수 함수, `wxRefresh` fetch+캐시, `renderSummary`·`renderTimeline` 날씨 줄, 현재 일차 추적 변수 |
| `test.html` | 순수 함수 단언 추가 |
| `styles.css` | 날씨 줄 스타일 |
| `sw.js` | 캐시 v6 → v7 (API 요청은 sw fetch 핸들러의 네트워크 우선 경로를 그대로 타므로 별도 처리 불요 — 단 cross-origin GET이므로 캐시 put 대상에서 제외해야 안전) |
| `data.js` | 변경 없음 |

## 검증

1. test.html — wxIcon 경계값(0,2,3,48,57,67,82,95), wxDailyMap 변환, wxLine 포맷·null 강수·없는 날짜
2. 온라인: 상단 + 일차별 날씨 표시, 스탬프 없음
3. 오프라인(DevTools): 마지막 예보 + 스탬프 표시
4. 캐시 없는 첫 방문 오프라인: 날씨 줄 없음, 콘솔 에러 없음
5. localStorage `weather` 저장 확인
