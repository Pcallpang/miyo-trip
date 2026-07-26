# -*- coding: utf-8 -*-
"""styles.css + data.js + app.js 를 index.html 구조에 인라인해
단일 자체완결형 osaka-trip.html 을 생성한다 (모바일 file:// 대응)."""
import base64
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
def read(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return f.read()

def data_uri(name, mime):
    with open(os.path.join(BASE, name), "rb") as f:
        return "data:" + mime + ";base64," + base64.b64encode(f.read()).decode("ascii")

css = read("styles.css")
data = read("data.js")
app = read("app.js")
usj_map = json.dumps(data_uri("usj-map-ko.webp", "image/webp"))

html = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b7285">
<meta name="color-scheme" content="light">
<title>오사카 여행</title>
<style>
""" + css + """
</style>
</head>
<body>
<header id="summary"></header>
<nav id="daytabs"></nav>
<main id="timeline"></main>
<section id="fixed"></section>
<script>
window.USJ_MAP_SRC = """ + usj_map + """;
""" + data + """
</script>
<script>
""" + app + """
</script>
</body>
</html>
"""

out = os.path.join(BASE, "osaka-trip.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", out, "(", len(html), "chars )")
