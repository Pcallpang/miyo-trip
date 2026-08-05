# -*- coding: utf-8 -*-
"""data.js(구 스키마) -> sample-trip.js(새 스키마) 1회 변환.
아코디언 순서를 원본 그대로 재현하려고 sections에 내장 섹션까지 함께 넣는다.

주의: 이 스크립트는 이미 한 번 실행돼 sample-trip.js를 만들어 낸 뒤로는 다시 돌지
않는다. 입력인 data.js가 0eb7d6f 커밋("해시 라우터와 여행 목록 화면, data.js 하드코딩 제거")
에서 삭제됐기 때문이다. 따라서 sample-trip.js는 더 이상 재생성할 수
없고, 손볼 일이 있으면 sample-trip.js를 직접 고치면 된다. 파일을 지우지 않고 남겨 두는
이유는 샘플 데이터가 어떤 구 스키마에서 어떤 규칙으로 나왔는지(특히 sections 순서와
i_<n>_<i> 형태의 항목 id) 기록해 두는 유일한 문서이기 때문이다. 다시 돌리려면
`git show 0eb7d6f^:data.js`로 원본을 꺼내 와야 한다."""
import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE, "data.js"), encoding="utf-8") as f:
    src = f.read()
old = json.loads(re.sub(r"^\s*window\.TRIP\s*=\s*", "", src).rstrip().rstrip(";"))

meta = old["meta"]

days = []
for d in old["days"]:
    days.append({
        "n": d["n"], "date": d["date"], "theme": d.get("theme", ""),
        "place": None, "curCode": None,
        "items": [{"id": "i_%d_%d" % (d["n"], i), "time": it["time"], "text": it["text"]}
                  for i, it in enumerate(d.get("items", []))],
        "meals": d.get("meals", []),
        "images": [],
    })

def rapit_table(caption, rows):
    return {"caption": caption, "head": ["편", "출발", "도착"],
            "rows": [[r["type"], r["dep"], r["arr"]] for r in rows]}

sections = [
    {"id": "s_rapit", "icon": "🚄", "title": "라피트 시간표", "type": "table",
     "body": [rapit_table("간사이 → 난바", old["rapit"]["to"]),
              rapit_table("난바 → 간사이", old["rapit"]["from"])]},
    {"id": "s_hotel",    "icon": "🏨", "title": "숙소",      "type": "builtin", "body": "hotel"},
    {"id": "s_packing",  "icon": "🎒", "title": "준비물",    "type": "builtin", "body": "packing"},
    {"id": "s_spend",    "icon": "💸", "title": "현지 경비", "type": "builtin", "body": "spend"},
    {"id": "s_expenses", "icon": "💰", "title": "경비 내역", "type": "builtin", "body": "expenses"},
    {"id": "s_tips", "icon": "💡", "title": "팁", "type": "list", "body": old["tips"]},
]

trip = {
    "schema": 1,
    "title": meta["title"],
    "start": meta["start"], "end": meta["end"],
    "party": 2,
    "place": {"name": "오사카", "country": "일본",
              "lat": 34.69, "lon": 135.5, "tz": "Asia/Tokyo"},
    "currency": {"code": "JPY", "symbol": "¥", "decimals": 0, "unit": 100},
    "hotel": meta["hotel"],
    "budgetKRW": meta["totalCostKRW"],
    "days": days,
    "sections": sections,
    "packing": old["packing"],
    "expenses": old["expenses"],
}

out = os.path.join(BASE, "sample-trip.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.SAMPLE_TRIP = " +
            json.dumps(trip, ensure_ascii=False, indent=2) + ";\n")
print("wrote", out)
