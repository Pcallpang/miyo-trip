# 소개/등록용 미리보기 그림 (16:10, 1600x1000).
#
# og-image(1.91:1)보다 세로가 넉넉해서 앱 화면을 통째로 넣을 수 있다. 잘라 낸
# 조각이 아니라 폰 화면 전체를 세 장 세워 "이런 앱이구나"가 한눈에 보이게 한다.
import os
from PIL import Image, ImageDraw
from brand import (canvas, miyo, paste, shadow, round_corners, text, chip, font,
                   SHOTS, CREAM_DEEP, WHITE, MINT, MINT_DARK, TAN_DARK,
                   INK, INK_SOFT, BASE)

W, H = 1600, 1000
OUT = os.path.join(os.path.dirname(BASE), "preview.png")


def phone(name, width):
    """폰 화면 한 장을 기기처럼 만든다. 흰 테두리를 둘러 배경에서 떼어 놓는다 —
    크림 배경에 크림색 앱 화면을 그냥 얹으면 경계가 사라진다."""
    im = Image.open(os.path.join(SHOTS, name + ".png")).convert("RGB")
    h = round(im.height * width / im.width)
    im = round_corners(im.resize((width, h), Image.LANCZOS), 26)

    pad = 10
    body = Image.new("RGBA", (width + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(
        [0, 0, body.width - 1, body.height - 1], radius=36, fill=WHITE)
    body.alpha_composite(im, (pad, pad))
    return body


def place(dst, im, center_x, bottom_y):
    sh = shadow(im.size, 36, blur=30, spread=16, alpha=70)
    x, y = center_x - im.width // 2, bottom_y - im.height
    dst.paste(sh, (x - sh.width // 2 + im.width // 2,
                   y - sh.height // 2 + im.height // 2), sh)
    dst.alpha_composite(im, (x, y))


def bullet(d, x, y, title, body):
    d.ellipse([x, y, x + 44, y + 44], fill=MINT)
    # 맑은 고딕에 U+2713이 없어 글자로 찍으면 두부(□)가 된다. 직접 긋는다.
    d.line([(x + 12, y + 22), (x + 20, y + 31), (x + 33, y + 13)],
           fill=INK, width=5, joint="curve")
    d.text((x + 62, y - 2), title, font=font(32, True), fill=INK)
    d.text((x + 62, y + 34), body, font=font(24, False), fill=INK_SOFT)


def make():
    im = canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)
    # 오른쪽 덩어리 위에 폰을 세운다. 글자는 왼쪽에만 모아 둔다.
    d.rounded_rectangle([800, -160, W + 240, H + 160], radius=200, fill=CREAM_DEEP)

    # 뒤 두 장 먼저, 가운데 앞 장을 마지막에 — 겹치는 순서가 곧 그리는 순서다.
    # 오른쪽 장이 캔버스를 넘지 않게 중심을 안쪽으로 당겼다(폭 250이면 최대 1475).
    place(im, phone("money", 250), 1030, 810)
    place(im, phone("packing", 250), 1400, 810)
    place(im, phone("day", 300), 1215, 890)
    # 캐릭터는 앞 폰을 가리지 않게 왼쪽 아래 빈 곳에 세운다.
    paste(im, miyo("yarr-miyo", 200), (880, 985), "cb")

    w, _ = chip(ImageDraw.Draw(canvas(W, H)), (0, 0), "야르미요의 여행 플래너", 30)
    chip(d, (90, 108), "야르미요의 여행 플래너", 30)
    text(d, (90, 190), "여행 일정,\n앱 하나로 끝.", 78, INK, True)
    text(d, (90, 400), "일정·경비·준비물·날씨를 한 곳에 모읍니다.\n로그인도 설치도 없이 브라우저에서 바로 씁니다.",
         28, INK_SOFT, False)

    rows = [("로그인이 없습니다", "가입도 계정도 없이 링크 열면 바로 시작"),
            ("비행기에서도 됩니다", "인터넷이 없어도 일정이 그대로 보입니다"),
            ("환율은 알아서 원화로", "현지 통화로 넣으면 자동 환산됩니다"),
            ("데이터는 내 기기에만", "서버가 없어 밖으로 나가지 않습니다")]
    y = 540
    for t, s in rows:
        bullet(d, 90, y, t, s)
        y += 92

    d.rounded_rectangle([90, 912, 430, 968], radius=28, fill=MINT)
    d.text((260, 940), "무료 · 광고 없음", font=font(28, True), fill=INK, anchor="mm")
    return im.convert("RGB")


if __name__ == "__main__":
    make().save(OUT)
    print("wrote", OUT, Image.open(OUT).size)
