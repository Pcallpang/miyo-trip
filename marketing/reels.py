# 인스타 릴스 (1080x1920, 30fps, 무음). 길이는 SCENES 합으로 정해진다.
#
# 소리는 넣지 않는다 — 릴스는 인스타 앱 안에서 정식 음원을 얹는 쪽이 저작권도
# 깨끗하고 도달에도 유리하다. 여기서는 그림만 만든다.
#
# 안전 영역: 릴스 UI가 아래 ~350px(캡션·버튼)와 오른쪽 ~200px(사이드 버튼)을
# 덮는다. 중요한 글자는 y 200~1450, x 100~950 안에 둔다.
import os
import shutil
import subprocess
from PIL import Image, ImageDraw
from brand import (canvas, miyo, paste, card, text, chip, phone_crop, font,
                   CREAM, CREAM_DEEP, WHITE, MINT, MINT_DARK, MINT_LIGHT, TAN,
                   TAN_DARK, INK, INK_SOFT, LINE, BASE)

W, H = 1080, 1920
FPS = 30
OUT = os.path.join(BASE, "reels")
FRAMES = os.path.join(
    r"C:\Users\admin\AppData\Local\Temp\claude\C--Pcall-Trip"
    r"\f379861d-1641-45c3-97c6-75f5fe62fc83\scratchpad", "reelframes")
FFMPEG = (r"C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
          r"\ffmpeg-9.0-full_build\bin\ffmpeg.exe")


# ---- 시간 곡선 ----
def ease(x):
    """감속(ease-out cubic). 들어올 때 빠르고 멈출 때 부드럽다."""
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def seg(t, start, dur):
    """t가 [start, start+dur] 구간에서 0→1로 가는 진행도."""
    return ease((t - start) / dur) if dur else 1.0


def inout(t, dur, fi=0.35, fo=0.25):
    """장면 안에서의 밝기. 들어올 때 밝아지고 나갈 때 어두워진다."""
    return min(seg(t, 0, fi), 1 - seg(t, dur - fo, fo))


def layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def stamp(base, lay, alpha=1.0, dy=0):
    """알파를 곱해 얹는다. dy로 살짝 떠오르는 움직임을 준다."""
    if alpha <= 0:
        return
    if dy:
        moved = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        moved.paste(lay, (0, round(dy)))
        lay = moved
    if alpha < 1:
        a = lay.getchannel("A").point(lambda v: round(v * alpha))
        lay = lay.copy()
        lay.putalpha(a)
    base.alpha_composite(lay)


# ---- 장면 ----
def sc_hook(t, dur):
    im = canvas(W, H).convert("RGBA")
    p = inout(t, dur)
    lay = layer()
    d = ImageDraw.Draw(lay)
    paste(lay, miyo("why-miyo", 470), (W // 2, 760), "cb")
    text(d, (W // 2, 880), "여행 일정,\n아직도 카톡방에\n흩어져 있나요?", 88, INK, True, "ma")
    stamp(im, lay, p, (1 - seg(t, 0, 0.5)) * 40)
    return im


def sc_brand(t, dur):
    im = canvas(W, H).convert("RGBA")
    p = inout(t, dur)
    lay = layer()
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([-100, -300, W + 100, 640], radius=140, fill=CREAM_DEEP)
    # 캐릭터만 조금 늦게, 통 튀어오르듯 들어온다.
    b = seg(t, 0.15, 0.6)
    paste(lay, miyo("yarr-miyo", round(300 + 200 * b)), (W // 2, 640), "cb")
    text(d, (W // 2, 780), "미요가 정리해 줄게요", 76, INK, True, "ma")
    w, _ = chip(ImageDraw.Draw(canvas(W, H)), (0, 0), "야르미요의 여행 플래너", 48)
    chip(d, ((W - w) // 2, 940), "야르미요의 여행 플래너", 48)
    stamp(im, lay, p)
    return im


def sc_feature(t, dur, n, label, head, shot, top, char):
    im = canvas(W, H).convert("RGBA")
    p = inout(t, dur)
    lay = layer()
    d = ImageDraw.Draw(lay)
    chip(d, (100, 250), f"{n}  {label}", 44)
    text(d, (100, 350), head, 72, INK, True)
    paste(lay, miyo(char, 260), (990, 560), "rb")
    stamp(im, lay, p, (1 - seg(t, 0, 0.45)) * 30)

    # 앱 화면은 조금 늦게 아래에서 떠오른다 — 말이 먼저, 근거가 뒤.
    cw, ch = 820, 880
    pc = phone_crop(shot, top, top + round(ch * 780 / cw), cw, radius=34, fade=80)
    cl = layer()
    card(cl, ((W - cw) // 2, 620), pc, 34)
    rise = seg(t, 0.3, 0.7)
    stamp(im, cl, min(p, rise), (1 - rise) * 90)
    return im


def sc_why(t, dur):
    im = canvas(W, H).convert("RGBA")
    p = inout(t, dur)
    lay = layer()
    d = ImageDraw.Draw(lay)
    text(d, (100, 300), "그래서", 60, TAN_DARK, True)
    stamp(im, lay, p)
    rows = ["로그인 없음", "설치 없음", "비행기에서도 됨", "공짜"]
    for i, s in enumerate(rows):
        rl = layer()
        rd = ImageDraw.Draw(rl)
        y = 430 + i * 210
        rd.rounded_rectangle([100, y, W - 130, y + 170], radius=40,
                             fill=MINT_LIGHT if i % 2 == 0 else WHITE,
                             outline=LINE, width=3)
        rd.ellipse([150, y + 55, 210, y + 115], fill=MINT)
        rd.line([(166, y + 85), (178, y + 98), (196, y + 72)], fill=INK,
                width=8, joint="curve")
        rd.text((250, y + 85), s, font=font(62, True), fill=INK, anchor="lm")
        # 한 줄씩 차례로 들어온다 — 네 개가 한꺼번에 뜨면 안 읽힌다.
        # 간격이 넓으면 마지막 줄이 뜨자마자 장면이 끝나 버려서 0.18초로 좁혔다.
        a = seg(t, 0.1 + i * 0.18, 0.4)
        stamp(im, rl, min(p, a), (1 - a) * 45)
    return im


def sc_cta(t, dur):
    im = canvas(W, H).convert("RGBA")
    p = inout(t, dur, fo=0.01)
    lay = layer()
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([-100, 980, W + 100, H + 300], radius=140, fill=CREAM_DEEP)
    paste(lay, miyo("yarr-miyo", 420), (W // 2, 670), "cb")
    text(d, (W // 2, 710), "야르미요의\n여행 플래너", 82, INK, True, "ma")
    stamp(im, lay, p)

    # 주소는 넣지 않는다 — 인스타에서 글자 주소는 클릭이 안 된다. 프로필 링크로 보낸다.
    bl = layer()
    bd = ImageDraw.Draw(bl)
    text(bd, (W // 2, 1000), "프로필 링크에서 열어 보세요", 46, TAN_DARK, True, "ma")
    a1 = seg(t, 0.35, 0.45)
    stamp(im, bl, min(p, a1), (1 - a1) * 40)

    # 댓글 유도는 그보다 늦게 띄운다 — 같이 뜨면 눈이 둘로 갈려 둘 다 안 읽힌다.
    cl = layer()
    cd = ImageDraw.Draw(cl)
    cd.rounded_rectangle([130, 1110, W - 130, 1370], radius=48, fill=WHITE,
                         outline=MINT_DARK, width=5)
    text(cd, (W // 2, 1162), "궁금하면 댓글로", 48, INK_SOFT, False, "ma")
    text(cd, (W // 2, 1240), "'미요'라고 달아주세요", 60, INK, True, "ma")
    a2 = seg(t, 0.7, 0.5)
    stamp(im, cl, min(p, a2), (1 - a2) * 40)
    return im


# (길이(초), 그리는 함수)
SCENES = [
    (2.5, sc_hook),
    (2.5, sc_brand),
    (3.0, lambda t, d: sc_feature(t, d, "①", "일정", "1일차부터\n마지막 날까지",
                                  "day", 500, "nep-miyo")),
    (2.5, lambda t, d: sc_feature(t, d, "②", "경비", "환율은\n알아서 원화로",
                                  "money", 800, "ppak-miyo")),
    (2.5, lambda t, d: sc_feature(t, d, "③", "준비물", "빠뜨린 것\n없이 체크",
                                  "packing", 380, "yarr-miyo")),
    (2.5, sc_why),
    # 마지막 장면만 길다 — 주소와 댓글 유도가 차례로 떠서 읽을 시간이 필요하다.
    (4.0, sc_cta),
]
TOTAL = sum(s[0] for s in SCENES)


def frame_at(t):
    acc = 0.0
    for dur, fn in SCENES:
        if t < acc + dur:
            return fn(t - acc, dur)
        acc += dur
    dur, fn = SCENES[-1]
    return fn(dur, dur)


def main():
    if os.path.isdir(FRAMES):
        shutil.rmtree(FRAMES)
    os.makedirs(FRAMES)
    os.makedirs(OUT, exist_ok=True)
    n = round(TOTAL * FPS)
    for i in range(n):
        im = frame_at(i / FPS).convert("RGB")
        im.save(os.path.join(FRAMES, f"{i:04d}.png"))
        if i % 60 == 0:
            print("frame", i, "/", n)
    mp4 = os.path.join(OUT, "reels-%ds.mp4" % round(TOTAL))
    subprocess.run([FFMPEG, "-y", "-framerate", str(FPS),
                    "-i", os.path.join(FRAMES, "%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-profile:v", "high", "-crf", "20",
                    "-movflags", "+faststart", mp4], check=True)
    print("wrote", mp4, os.path.getsize(mp4) // 1024, "KB")


if __name__ == "__main__":
    main()
