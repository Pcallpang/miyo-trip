# -*- coding: utf-8 -*-
"""오사카 여행일정.xlsx -> data.js 생성 (1회성, 재현 가능)."""
import openpyxl, json, os, re

SRC = r"C:\Pcall\오사카 여행일정.xlsx"
OUT = r"C:\Pcall\Trip\data.js"

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["여행일정"]
grid = [[("" if c is None else str(c)) for c in row] for row in ws.iter_rows(values_only=True)]

day_meta = {1:("2026-07-28","화"),2:("2026-07-29","수"),3:("2026-07-30","목"),
            4:("2026-07-31","금"),5:("2026-08-01","토"),6:("2026-08-02","일"),7:("2026-08-03","월")}
times = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00",
         "16:00","17:00","18:00","19:00","20:00","21:00"]

days = []
for d in range(1, 8):
    col = d + 1                      # xlsx col index: day1 -> 2 ... day7 -> 8
    theme = grid[3][col].strip()     # 비고 행
    items = []
    for ti, t in enumerate(times):
        r = 5 + ti                   # 08:00 행부터
        val = grid[r][col].strip() if col < len(grid[r]) else ""
        if val:
            items.append({"time": t, "text": val})
    days.append({"n": d, "date": day_meta[d][0], "dow": day_meta[d][1],
                 "theme": theme, "items": items})

# 일차별 "뭐먹지"(식사 미정) 블록: 시간표 오른쪽 별도 표
# grid 행 3~8, 열 10=일차 라벨, 열 11/12=메뉴 미정 텍스트
meals_by_day = {}
for r in range(3, 9):
    row = grid[r]
    label = row[10].strip() if len(row) > 10 else ""
    m = re.match(r"(\d+)일차", label)
    if not m:
        continue
    dn = int(m.group(1))
    cells = [
        row[11].strip() if len(row) > 11 else "",
        row[12].strip() if len(row) > 12 else "",
    ]
    meals_by_day[dn] = [c for c in cells if c]
for d in days:
    d["meals"] = meals_by_day.get(d["n"], [])

# 라피트 시간표 (수기 매핑: 시트가 좌=간사이출발, 우=난바출발)
rapit = {
    "to": [   # 간사이 -> 난바
        {"type":"특급 라피트 α","dep":"13:05","arr":"13:43"},
        {"type":"특급 라피트 β","dep":"13:35","arr":"14:14"},
        {"type":"특급 라피트 α","dep":"14:05","arr":"14:43"},
    ],
    "from": [ # 난바 -> 간사이
        {"type":"특급 라피트 α","dep":"10:05","arr":"10:41"},
        {"type":"특급 라피트 β","dep":"10:35","arr":"11:15"},
        {"type":"특급 라피트 α","dep":"11:05","arr":"11:41"},
    ],
}

expenses = [
    {"date":"", "cat":"항공권", "detail":"왕복", "pay":"신한카드", "krw":766640, "note":""},
    {"date":"", "cat":"숙소", "detail":"6박", "pay":"신한카드", "krw":751232, "note":""},
    {"date":"2026-06-21","cat":"유니버셜 스튜디오 티켓","detail":"입장권(2인)","pay":"네이버페이","krw":186000,"note":""},
    {"date":"","cat":"유니버셜 스튜디오 티켓","detail":"패스권(2인)","pay":"","krw":540689,"note":""},
    {"date":"2026-06-22","cat":"버스투어","detail":"교토버스투어(2인)","pay":"신한카드","krw":61239,"note":""},
    {"date":"2026-06-24","cat":"버스투어","detail":"나라/고베버스투어(2인)","pay":"신한카드","krw":77900,"note":""},
    {"date":"2026-07-05","cat":"가이유칸 수족관","detail":"입장권(2인)","pay":"신한카드","krw":60678,"note":""},
    {"date":"2026-07-26","cat":"오사카 주유패스","detail":"2일권 2인","pay":"신한카드","krw":89772,"note":""},
    {"date":"2026-07-26","cat":"e-sim","detail":"7일 2기가 1인","pay":"신한카드","krw":12011,"note":"승유니 이심"},
    {"date":"2026-07-26","cat":"여행자보험","detail":"2인","pay":"카카오페이","krw":13230,"note":""},
    {"date":"2026-07-26","cat":"라피트","detail":"편도(간사이→난바)","pay":"신한카드","krw":26488,"note":""},
    {"date":"2026-07-27","cat":"라피트","detail":"편도(난바→간사이)","pay":"신한카드","krw":26488,"note":""},
]
total = sum(e["krw"] for e in expenses)  # = 2612367

data = {
    "meta": {
        "title":"오사카 여행", "start":"2026-07-28", "end":"2026-08-03",
        "nights":6, "days":7,
        "hotel":"포포인츠 플렉스 바이 쉐라톤 오사카 신사이바시 (체크인 15시 · 체크아웃 11시)",
        "totalCostKRW": total,
    },
    "days": days,
    "rapit": rapit,
    "packing": ["우양산","모자","선글라스","손선풍기","편한 신발 또는 샌들","동전"],
    "expenses": expenses,
    "tips": [
        "5500엔 이상 구매 시 면세: 제품·영수증·여권 들고 입구 근처 면세 카운터에서 현금 반환 (14:00~폐장 1시간 전)",
        "준비물: 우양산, 모자, 선글라스, 손선풍기, 편한 신발/샌들, 동전",
    ],
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.TRIP = ")
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(";\n")
print("wrote", OUT, "total", total)
