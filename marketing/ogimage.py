# 링크 공유용 미리보기 그림 (og:image, 1200x630).
#
# 카톡·슬랙·디스코드가 링크를 펼칠 때 쓰는 그림이다. 규격이 1.91:1로 고정이라
# 인스타용(4:5, 9:16)을 그대로 쓸 수 없어 따로 그린다.
#
# 잘림 주의: 서비스마다 양옆이나 위아래를 조금씩 잘라 낸다. 글자는 가운데
# 1000x500 안에 둔다.
import os
from PIL import ImageDraw
from brand import (canvas, miyo, paste, text, font,
                   CREAM, CREAM_DEEP, MINT, TAN_DARK, INK, INK_SOFT, BASE)

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(BASE), "og-image.png")


def make():
    im = canvas(W, H)
    d = ImageDraw.Draw(im)
    # 오른쪽에 크림딥 덩어리를 두고 그 위에 캐릭터를 세운다. 글자는 왼쪽에 모은다 —
    # 좌우로 꽉 채우면 잘리는 서비스에서 글자부터 날아간다.
    d.rounded_rectangle([760, -120, W + 200, H + 120], radius=160, fill=CREAM_DEEP)
    paste(im, miyo("yarr-miyo", 420), (975, 560), "cb")

    text(d, (90, 150), "야르미요의", 54, TAN_DARK, True)
    text(d, (90, 225), "여행 플래너", 96, INK, True)
    text(d, (90, 370), "일정 · 경비 · 준비물 · 날씨를 한 곳에.\n로그인도 설치도 없이 바로 씁니다.",
         34, INK_SOFT, False)

    d.rounded_rectangle([90, 500, 470, 570], radius=35, fill=MINT)
    d.text((280, 535), "무료 · 가입 없음", font=font(32, True), fill=INK, anchor="mm")
    return im


if __name__ == "__main__":
    make().save(OUT)
    print("wrote", OUT)
