"""
把精选图片裁剪/压缩后放进 web/src/assets/。
原始来源：
  - jinsui 自有部署的 assets/scene/farm-satellite.jpg、/uploads/demo/*.jpg
  - Wikimedia Commons 的 CC 授权病害实拍
  - Unsplash / Pexels 的真实农场景
  - 团队本地硬件照片 _pool/
所有文件统一转为 sRGB JPEG，宽度受控，避免把几十 MB 打进前端产物。
"""
import io
import os
from PIL import Image

SRC_JIN = r"E:\挑战杯\大创\_jinsui"
SRC_POOL = r"E:\挑战杯\大创\_pool"
DST = r"E:\挑战杯\_大创平台\web\src\assets"

# (源文件, 目标名, 最大宽度, 最大高度)
SCENES = [
    (os.path.join(SRC_JIN, "farm-satellite.jpg"), "field-satellite.jpg", 1600, 1600),
    (os.path.join(SRC_JIN, "field_wheat.jpg"), "field-wheat.jpg", 1400, 1400),
    (os.path.join(SRC_JIN, "wheat_close.jpg"), "wheat-close.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "green_wheat.jpg"), "wheat-green.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "wheat_field2.jpg"), "field-wheat-2.jpg", 1400, 1400),
    (os.path.join(SRC_JIN, "research_field.jpg"), "field-research.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "agri_drone.jpg"), "uav-field.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "drone_spray.jpg"), "uav-spray.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "drone_flying.jpg"), "uav-flying.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "robot_ag.jpg"), "robot-field.jpg", 1200, 1200),
    (os.path.join(SRC_JIN, "spray_tractor.jpg"), "tractor-spray.jpg", 1200, 1400),
]

DISEASES = [
    (os.path.join(SRC_JIN, "wm_rust.jpg"), "dis-rust.jpg", 900, 900),
    (os.path.join(SRC_JIN, "wm_powdery.jpg"), "dis-powdery.jpg", 900, 1200),
    (os.path.join(SRC_JIN, "wm_powdery2.jpg"), "dis-powdery-b.jpg", 900, 900),
    (os.path.join(SRC_JIN, "wm_loosesmut.jpg"), "dis-loose-smut.jpg", 800, 1200),
    (os.path.join(SRC_JIN, "wm_rootrot.jpg"), "dis-root-rot.jpg", 900, 900),
    (os.path.join(SRC_JIN, "wm_fusarium.jpg"), "dis-fusarium.jpg", 700, 700),
    (os.path.join(SRC_JIN, "wm_leafblight.jpg"), "dis-leaf-blight.jpg", 900, 900),
]

HARDWARE = [
    (os.path.join(SRC_POOL, "s9_1.jpeg"), "hw-uav-1.jpg", 1400, 1400),
    (os.path.join(SRC_POOL, "s20_52.png"), "hw-robot.jpg", 1200, 1200),
    (os.path.join(SRC_POOL, "s10_2.png"), "hw-uav-2.jpg", 1200, 1200),
    (os.path.join(SRC_POOL, "s26_5.png"), "hw-board.jpg", 1000, 1000),
    (os.path.join(SRC_POOL, "s26_19.png"), "hw-field-1.jpg", 1200, 1200),
    (os.path.join(SRC_POOL, "s26_21.png"), "hw-field-2.jpg", 1000, 1400),
    (os.path.join(SRC_POOL, "s14_9.png"), "hw-detail.jpg", 900, 900),
    (os.path.join(SRC_POOL, "s10_13.png"), "hw-uav-3.jpg", 1000, 1000),
]


def conv(src, dst_name, max_w, max_h, subdir):
    out_dir = os.path.join(DST, subdir)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, dst_name)
    if not os.path.exists(src):
        print("MISS", src)
        return
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im.thumbnail((max_w, max_h), Image.LANCZOS)
    im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print("OK  %-24s %sx%s  %d KB" % (dst_name, im.size[0], im.size[1], os.path.getsize(out) // 1024))


if __name__ == "__main__":
    for s in SCENES:
        conv(s[0], s[1], s[2], s[3], "scene")
    for s in DISEASES:
        conv(s[0], s[1], s[2], s[3], "disease")
    for s in HARDWARE:
        conv(s[0], s[1], s[2], s[3], "hardware")
