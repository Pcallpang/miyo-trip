# 캡처 하네스가 찍은 3조각을 폰 화면 한 장으로 잇는다.
#
# 창이 607px밖에 안 돼 840px짜리 폰 화면이 한 번에 안 들어간다. _capture.html이
# 390x840을 2배로 그린 뒤 280 CSS px씩 3번 밀어 찍었고, 여기서 그걸 세로로 잇는다.
#
# 잘라낼 위치는 계산하지 않고 찾아낸다 — 스크린샷 픽셀과 CSS px 비율이 1이 아니고
# (1425 vs 1389) 그 값도 신뢰할 수 없어서, 하네스 배경으로 깔아 둔 #101010과
# 앱 화면(크림색)의 경계를 직접 훑는다.
import os
from PIL import Image

SHOTS = r"C:\Users\admin\AppData\Local\Temp\claude-chrome-screenshots-gzdFkS"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
DARK = 60          # 이 값 이하 = 하네스 배경
PHONE = (780, 1680)  # 390x840의 2배

SCREENS = {
    "day":     ["screenshot-1786408906835-4.jpg",
                "screenshot-1786408906841-5.jpg",
                "screenshot-1786408906846-6.jpg"],
    "money":   ["screenshot-1786408935938-7.jpg",
                "screenshot-1786408935944-8.jpg",
                "screenshot-1786408935948-9.jpg"],
    "packing": ["screenshot-1786409008196-10.jpg",
                "screenshot-1786409014466-11.jpg",
                "screenshot-1786409057686-12.jpg"],
}


def content_box(im):
    """밝은(=앱 화면) 영역의 오른쪽·아래 경계를 찾는다."""
    px = im.convert("RGB").load()
    w, h = im.size
    # 오른쪽 끝: 위쪽 1/4 지점 가로줄을 훑는다(헤더라 확실히 밝다).
    y = h // 4
    right = w
    for x in range(w - 1, -1, -1):
        r, g, b = px[x, y]
        if max(r, g, b) > DARK:
            right = x + 1
            break
    # 아래 끝: 왼쪽에서 조금 들어온 세로줄을 훑는다.
    x = right // 4
    bottom = h
    for yy in range(h - 1, -1, -1):
        r, g, b = px[x, yy]
        if max(r, g, b) > DARK:
            bottom = yy + 1
            break
    return right, bottom


def stitch(name, files):
    ims = [Image.open(os.path.join(SHOTS, f)).convert("RGB") for f in files]
    right, bottom = content_box(ims[0])
    # 경계에서 1px은 배경(#101010)이 섞여 들어와 이음매에 검은 줄이 생긴다.
    # 2px씩 깎는다 — 화면상 1 CSS px도 안 되는 손실이라 티가 안 난다.
    right, bottom = right - 2, bottom - 2
    parts = [im.crop((0, 0, right, bottom)) for im in ims]
    total = Image.new("RGB", (right, bottom * len(parts)), "#FDF3E7")
    for i, p in enumerate(parts):
        total.paste(p, (0, bottom * i))
    total = total.resize(PHONE, Image.LANCZOS)
    path = os.path.join(OUT, name + ".png")
    total.save(path)
    print(name, "<-", right, "x", bottom, "each ->", total.size, "->", path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, files in SCREENS.items():
        stitch(name, files)
