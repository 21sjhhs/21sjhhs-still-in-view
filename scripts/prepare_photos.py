"""Prepare web-size, metadata-free copies of photographs without altering the originals."""
from io import BytesIO
import json
from pathlib import Path
import re

from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SETS = (
    ("ordinary-places", "寻常之地", "Ordinary Places", "鱼缸、街角、窗里的光。", "WechatIMG1898.jpg", "两尾鱼游过水面折射出的光"),
    ("places-we-inhabit", "栖身之所", "Places We Inhabit", "人在城市里停留、经过、栖身。", "WechatIMG1945.jpg", "几个人坐在草地尽头，面朝水岸"),
    ("portraits", "人像写真", "Portraits", "目光、动作，以及人与镜头之间的距离。", "WechatIMG1935.jpg", "戴红围巾的人举着橙红色气球"),
)
SOURCE_TYPES = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp"}
OUTPUT = ROOT / "docs/assets/photos"
SRGB = ImageCms.createProfile("sRGB")


def save_webp(image, directory, filename, width, quality):
    copy = image.copy()
    copy.thumbnail((width, width), Image.Resampling.LANCZOS)
    copy.save(directory / filename, "WEBP", quality=quality, method=6)
    return filename


def convert(source, directory, photo_id):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        profile = image.info.get("icc_profile")
        if profile:
            image = ImageCms.profileToProfile(
                image, ImageCms.ImageCmsProfile(BytesIO(profile)), SRGB, outputMode="RGB"
            )
        else:
            image = image.convert("RGB")
        image.info.clear()
        return {
            "small": save_webp(image, directory, f"{photo_id}-720.webp", 720, 82),
            "large": save_webp(image, directory, f"{photo_id}-1920.webp", 1920, 87),
            "width": image.width,
            "height": image.height,
        }


def photo_id(path):
    return re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-") or "image"


def main():
    collections = []
    for slug, name, title, description, cover_name, cover_alt in SETS:
        directory = OUTPUT / slug
        directory.mkdir(parents=True, exist_ok=True)
        sources = sorted(
            path for path in (ROOT / "摄影集" / name).iterdir()
            if path.is_file() and path.suffix.lower() in SOURCE_TYPES and not path.name.startswith(".")
        )
        planned_names = set()
        photos = []
        for index, source in enumerate(sources, start=1):
            photo = {
                "source": source.name,
                **convert(source, directory, f"{index:02}-{photo_id(source)}"),
            }
            planned_names.update((photo["small"], photo["large"]))
            photos.append(photo)
        cover = next(photo for photo in photos if photo["source"] == cover_name)
        cover["alt"] = cover_alt
        if slug == "places-we-inhabit":
            hero = next(photo for photo in photos if photo["source"] == "WechatIMG2089.jpg")
            hero["alt"] = "一辆白车驶过被树荫覆盖的道路"
        collections.append({
            "slug": slug,
            "name": name,
            "title": title,
            "description": description,
            "cover": cover,
            "photos": photos,
        })
        for old in directory.glob("*.webp"):
            if old.name not in planned_names:
                old.unlink()

    catalog = json.dumps(collections, ensure_ascii=False, indent=2)
    (OUTPUT.parent / "collections.json").write_text(catalog + "\n", encoding="utf-8")
    print(f"Prepared {sum(len(item['photos']) for item in collections)} photos across {len(collections)} collections.")


if __name__ == "__main__":
    main()
