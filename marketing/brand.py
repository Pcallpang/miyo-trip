# 릴스·캐러셀 공통 디자인 토킷. 색과 폰트는 앱(styles.css)에서 그대로 가져온다 —
# 홍보물이 앱을 열었을 때와 다른 인상을 주면 안 된다.
import os
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
MIYO = os.path.join(os.path.dirname(BASE), "assets", "miyo")
SHOTS = os.path.join(BASE, "shots")

# styles.css :root 토큰과 같은 값
CREAM = "#FDF3E7"
CREAM_DEEP = "#F5DFC0"
WHITE = "#FFFFFF"
MINT = "#8FD9B6"
MINT_DARK = "#6BC79C"
MINT_LIGHT = "#E3F7EC"
TAN = "#C9976A"
TAN_DARK = "#8B6F47"
INK = "#1A2B1E"
INK_SOFT = "#5A6B5E"
LINE = "#EDE0D0"

_BOLD = r"C:\Windows\Fonts\malgunbd.ttf"
_REG = r"C:\Windows\Fonts\malgun.ttf"
_cache = {}


def font(size, bold=True):
    key = (size, bold)
    if key not in _cache:
        _cache[key] = ImageFont.truetype(_BOLD if bold else _REG, size)
    return _cache[key]


def canvas(w, h, bg=CREAM):
    return Image.new("RGB", (w, h), bg)


@lru_cache(maxsize=None)
def miyo(name, height):
    """캐릭터를 높이 기준으로 불러온다. 원본은 배경이 지워진 webp다."""
    im = Image.open(os.path.join(MIYO, name + ".webp")).convert("RGBA")
    w = round(im.width * height / im.height)
    return im.resize((w, height), Image.LANCZOS)


def paste(dst, src, xy, anchor="lt"):
    """RGBA 이미지를 알파 유지한 채 얹는다. anchor로 기준점을 고른다."""
    x, y = xy
    if "c" in anchor[0:1] or anchor[0] == "c":
        x -= src.width // 2
    elif anchor[0] == "r":
        x -= src.width
    if anchor[1] == "c":
        y -= src.height // 2
    elif anchor[1] == "b":
        y -= src.height
    dst.paste(src, (round(x), round(y)), src)


@lru_cache(maxsize=None)
def shadow(size, radius, blur=28, spread=14, color=(90, 62, 24), alpha=64):
    """둥근 사각형 그림자 한 장. 카드·폰 목업 뒤에 깐다."""
    w, h = size
    lay = Image.new("RGBA", (w + spread * 4, h + spread * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([spread * 2, spread * 2 + spread // 2,
                         spread * 2 + w, spread * 2 + h + spread // 2],
                        radius=radius, fill=color + (alpha,))
    return lay.filter(ImageFilter.GaussianBlur(blur))


def round_corners(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1],
                                           radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


@lru_cache(maxsize=None)
def phone_crop(name, top, bottom, width, radius=28, fade=0):
    """폰 스크린샷(780x1680)에서 한 구간을 잘라 카드처럼 만든다.

    화면 전체를 작게 넣으면 인스타에서 앱 글씨가 안 읽힌다 — 보여줄 구간만
    잘라 크게 싣는다.

    fade: 아래쪽 몇 px을 서서히 투명하게 만들지. 목록 중간에서 뚝 잘리면 렌더링
    오류처럼 보이는데, 흐려 두면 "아래로 더 있다"는 뜻으로 읽힌다.
    """
    im = Image.open(os.path.join(SHOTS, name + ".png")).convert("RGB")
    im = im.crop((0, top, im.width, bottom))
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    out = round_corners(im, radius)
    if fade:
        a = out.getchannel("A")
        px = a.load()
        for y in range(max(0, h - fade), h):
            k = (h - y) / fade
            for x in range(width):
                px[x, y] = round(px[x, y] * k)
        out.putalpha(a)
    return out


def card(dst, xy, im, radius=28):
    """그림자와 함께 카드를 얹는다. xy는 카드 왼쪽 위."""
    x, y = xy
    sh = shadow(im.size, radius)
    dst.paste(sh, (round(x) - sh.width // 2 + im.width // 2,
                   round(y) - sh.height // 2 + im.height // 2), sh)
    dst.paste(im, (round(x), round(y)), im)


def text(d, xy, s, size, color=INK, bold=True, anchor="la", spacing=None):
    """여러 줄 텍스트. 한글은 줄바꿈 지점을 손으로 잡는 게 훨씬 깔끔해서
    자동 줄바꿈 대신 \\n을 그대로 쓴다."""
    f = font(size, bold)
    sp = round(size * 0.42) if spacing is None else spacing
    d.multiline_text(xy, s, font=f, fill=color, anchor=anchor,
                     spacing=sp, align="left" if anchor[0] == "l" else "center")


def text_size(s, size, bold=True, spacing=None):
    f = font(size, bold)
    sp = round(size * 0.42) if spacing is None else spacing
    tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    box = tmp.multiline_textbbox((0, 0), s, font=f, spacing=sp)
    return box[2] - box[0], box[3] - box[1]


def chip(d, xy, label, size=34, fg=INK, bg=MINT, pad=(26, 12)):
    """민트 알약 라벨. 앱의 선택된 탭과 같은 모양."""
    f = font(size, True)
    box = d.textbbox((0, 0), label, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    x, y = xy
    d.rounded_rectangle([x, y, x + w + pad[0] * 2, y + h + pad[1] * 2],
                        radius=(h + pad[1] * 2) // 2, fill=bg)
    d.text((x + pad[0] - box[0], y + pad[1] - box[1]), label, font=f, fill=fg)
    return w + pad[0] * 2, h + pad[1] * 2
