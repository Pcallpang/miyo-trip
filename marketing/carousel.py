# 인스타 피드 캐러셀 7장 (1080x1350, 4:5).
#
# 4:5로 잡는 이유: 피드에서 세로를 가장 많이 차지하는 비율이라 스크롤 중에 눈에
# 오래 남는다. 기능 슬라이드는 앱 화면을 통째로 넣지 않고 읽히는 구간만 잘라
# 크게 싣는다 — 폰으로 보면 슬라이드 폭이 40mm 남짓이라 통짜는 안 읽힌다.
import os
from PIL import ImageDraw
from brand import (canvas, miyo, paste, card, text, chip, phone_crop, font,
                   CREAM, CREAM_DEEP, WHITE, MINT, MINT_DARK, MINT_LIGHT, TAN,
                   TAN_DARK, INK, INK_SOFT, LINE, BASE)

W, H = 1080, 1350
OUT = os.path.join(BASE, "carousel")

# 주소는 이미지에 넣지 않는다 — 인스타에서 글자 주소는 클릭이 안 되고, 주소가
# 바뀌면 이미지를 통째로 다시 만들어야 한다. 안내는 프로필 링크로 한다.


def footer(d, page):
    """모든 장 아래에 쪽번호. 주소는 넣지 않는다 — 인스타에서 글자 주소는 클릭이
    안 돼 실효가 없고, 안내는 캡션의 '프로필 링크'와 마지막 장 댓글 유도로 한다."""
    d.text((W - 60, H - 62), f"{page} / 7", font=font(30, True), fill=TAN, anchor="rm")


def cover():
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([-80, -260, W + 80, 470], radius=120, fill=CREAM_DEEP)
    paste(im, miyo("yarr-miyo", 430), (W // 2, 470), "cb")
    text(d, (W // 2, 610), "여행 일정,\n앱 하나로 끝.", 96, INK, True, "ma")
    # 알약을 가운데 두려면 폭을 먼저 알아야 한다. 버리는 캔버스에 한 번 그려 재고,
    # 실제 캔버스에는 그 폭으로 한 번만 그린다.
    w, _ = chip(ImageDraw.Draw(canvas(W, H)), (0, 0), "야르미요의 여행 플래너", 38)
    chip(d, ((W - w) // 2, 960), "야르미요의 여행 플래너", 38)
    text(d, (W // 2, 1110), "넘겨보세요  →", 34, TAN_DARK, True, "ma")
    footer(d, 1)
    return im


def problem():
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    text(d, (72, 130), "여행 준비, 이런 적 없나요?", 44, TAN_DARK, True)
    rows = [("일정은", "카톡방 스크롤 저 위 어딘가"),
            ("예산은", "엑셀 파일, 폰에선 안 열림"),
            ("준비물은", "머릿속. 그래서 꼭 하나 빠짐")]
    y = 250
    for label, body in rows:
        d.rounded_rectangle([72, y, W - 72, y + 190], radius=32, fill=WHITE,
                            outline=LINE, width=2)
        d.text((116, y + 52), label, font=font(34, True), fill=TAN)
        d.text((116, y + 104), body, font=font(40, True), fill=INK)
        y += 222
    paste(im, miyo("why-miyo", 240), (W - 150, 1130), "cb")
    text(d, (72, 1030), "그래서\n만들었습니다.", 62, INK, True)
    footer(d, 2)
    return im


CARD_W, CARD_H, CARD_Y = 880, 680, 500


def feature(page, n, label, head, sub, shot, top, char):
    """기능 슬라이드.

    머리말을 두 줄로 접어 왼쪽 절반만 쓰고, 캐릭터는 비는 오른쪽에 세운다 —
    한 줄로 길게 쓰면 캐릭터가 글자 위에 올라앉는다.
    """
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    chip(d, (72, 96), f"{n}  {label}", 36)
    text(d, (72, 180), head, 58, INK, True)
    text(d, (72, 370), sub, 32, INK_SOFT, False)
    paste(im, miyo(char, 240), (W - 80, 430), "rb")
    # 원본에서 잘라 올 세로 = 카드 높이 × (원본 폭 / 카드 폭)
    src_h = round(CARD_H * 780 / CARD_W)
    pc = phone_crop(shot, top, top + src_h, CARD_W, radius=30, fade=70)
    card(im, ((W - CARD_W) // 2, CARD_Y), pc, 30)
    footer(d, page)
    return im


def why():
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    text(d, (72, 120), "왜 이걸 쓰냐면", 62, INK, True)
    rows = [("로그인이 없습니다", "가입도 계정도 없습니다. 링크 열면 바로 시작."),
            ("설치가 없습니다", "브라우저에서 그냥 열립니다. 홈 화면에 추가하면 앱처럼."),
            ("비행기에서도 됩니다", "한 번 열어 두면 인터넷 없이도 일정이 보입니다."),
            ("공짜입니다", "광고도 결제도 없습니다. 데이터는 내 폰에만 있습니다.")]
    y = 270
    for i, (t, s) in enumerate(rows):
        d.rounded_rectangle([72, y, W - 72, y + 210], radius=32,
                            fill=MINT_LIGHT if i % 2 == 0 else WHITE,
                            outline=LINE, width=2)
        d.ellipse([116, y + 78, 168, y + 130], fill=MINT)
        # 맑은 고딕에 U+2713이 없어 글자로 찍으면 두부(□)가 된다. 직접 긋는다.
        d.line([(130, y + 104), (140, y + 115), (156, y + 93)], fill=INK, width=6,
               joint="curve")
        d.text((196, y + 58), t, font=font(44, True), fill=INK)
        d.text((196, y + 122), s, font=font(30, False), fill=INK_SOFT)
        y += 234
    footer(d, 6)
    return im


def cta():
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([-80, 720, W + 80, H + 200], radius=120, fill=CREAM_DEEP)
    paste(im, miyo("yarr-miyo", 380), (W // 2, 440), "cb")
    text(d, (W // 2, 490), "지금 열어 보세요", 76, INK, True, "ma")
    text(d, (W // 2, 610), "프로필 링크에 주소가 있어요\n샘플 여행이 들어 있어 바로 눌러 볼 수 있습니다", 34,
         INK_SOFT, False, "ma")
    text(d, (W // 2, 740), "저장해 두었다가 다음 여행 짤 때 꺼내 쓰세요", 32, TAN_DARK, True, "ma")
    # 댓글 유도. 주소를 뺀 지금은 이게 이 장의 유일한 행동 지시라 가장 크게 둔다.
    # 흰 카드로 떼어 놓아야 크림 바탕에 묻히지 않는다.
    d.rounded_rectangle([90, 830, W - 90, 1075], radius=48, fill=WHITE,
                        outline=MINT_DARK, width=4)
    text(d, (W // 2, 878), "궁금하면 댓글로", 40, INK_SOFT, False, "ma")
    text(d, (W // 2, 950), "'미요'라고 달아주세요", 52, INK, True, "ma")
    footer(d, 7)
    return im


SLIDES = [
    cover,
    problem,
    lambda: feature(3, "①", "일정", "1일차부터\n마지막 날까지",
                    "시간·장소·메모를 일차별로.\n날씨도 그 도시 기준으로 붙습니다.",
                    "day", 500, "nep-miyo"),
    lambda: feature(4, "②", "경비", "환율은\n알아서 원화로",
                    "출발 전 결제와 현지 지출을 따로.\n환율은 자동으로 받아 옵니다.",
                    "money", 800, "ppak-miyo"),
    lambda: feature(5, "③", "준비물", "빠뜨린 것\n없이 체크",
                    "기본 목록이 들어 있고,\n내 물건은 직접 추가할 수 있습니다.",
                    "packing", 380, "yarr-miyo"),
    why,
    cta,
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for i, make in enumerate(SLIDES, 1):
        p = os.path.join(OUT, f"{i:02d}.png")
        make().save(p)
        print("wrote", p)
