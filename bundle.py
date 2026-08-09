# -*- coding: utf-8 -*-
"""styles.css + 스크립트들을 index.html 구조에 인라인해
단일 자체완결형 trip.html 을 생성한다 (모바일 file:// 대응)."""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
def read(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return f.read()

SCRIPTS = ["sample-trip.js", "store.js", "schema.js", "cities.js", "country-info.js", "money.js", "remote.js", "views.js", "editor.js", "app.js"]

html = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b7285">
<meta name="color-scheme" content="light">
<title>여행 플래너</title>
<style>
""" + read("styles.css") + """
</style>
</head>
<body>
<section id="screen-list" hidden>
<header class="lhead"><h1>내 여행</h1></header>
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
""" + "".join("<script>\n" + read(s) + "\n</script>\n" for s in SCRIPTS) + """</body>
</html>
"""

out = os.path.join(BASE, "trip.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", out, "(", len(html), "chars )")
