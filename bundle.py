# -*- coding: utf-8 -*-
"""styles.css + 스크립트들을 index.html 구조에 인라인해
단일 자체완결형 trip.html 을 생성한다 (모바일 file:// 대응)."""
import base64
import glob
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
def read(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return f.read()

def miyo_data_uris():
    """미요 캐릭터를 data: URI로 바꿔 단일 파일에 담는다.
    file://에서는 assets/ 폴더를 못 읽으므로 그대로 두면 그림이 통째로 사라진다.

    두 벌을 낸다. JS(miyoImg)는 경로를 런타임에 조립하므로 문자열 치환이 걸리지
    않는다 — 이름→URI 표를 MIYO_DATA로 심어 miyoSrc가 찾아 쓰게 한다. HTML에 직접
    박힌 <img src="assets/miyo/...">는 경로 치환으로 바꾼다."""
    by_name, by_path = {}, {}
    for path in sorted(glob.glob(os.path.join(BASE, "assets", "miyo", "*.webp"))):
        name = os.path.splitext(os.path.basename(path))[0]
        with open(path, "rb") as f:
            uri = "data:image/webp;base64," + base64.b64encode(f.read()).decode()
        by_name[name] = uri
        by_path["assets/miyo/" + name + ".webp"] = uri
    return by_name, by_path

SCRIPTS = ["sample-trip.js", "store.js", "schema.js", "cities.js", "country-info.js", "money.js", "remote.js", "views.js", "editor.js", "app.js"]

html = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FDF3E7">
<meta name="color-scheme" content="light">
<title>여행 플래너</title>
<style>
""" + read("styles.css") + """
</style>
</head>
<body>
<section id="screen-list" hidden>
<header class="lhead"><img src="assets/miyo/yarr-miyo.webp" alt=""><h1>내 여행</h1></header>
<div id="triplist"></div>
<div class="lactions">
<button id="new-trip" type="button">+ 새 여행 만들기</button>
<button id="add-sample" type="button">샘플 여행 보기</button>
</div>
</section>
<section id="screen-trip" hidden>
<header id="summary"></header>
<div id="tab-day">
<nav id="daytabs"></nav>
<main id="timeline"></main>
</div>
<div id="tab-panel"></div>
<nav id="tabbar"></nav>
</section>
<section id="screen-edit" hidden></section>
""" + "<script>window.MIYO_DATA=__MIYO_JSON__;</script>\n" + \
      "".join("<script>\n" + read(s) + "\n</script>\n" for s in SCRIPTS) + """</body>
</html>
"""

by_name, by_path = miyo_data_uris()
html = html.replace("__MIYO_JSON__", json.dumps(by_name))
for path, uri in by_path.items():
    html = html.replace(path, uri)

out = os.path.join(BASE, "trip.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", out, "(", len(html), "chars )")
