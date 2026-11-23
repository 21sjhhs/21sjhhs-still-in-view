"""Prepare web-size, metadata-free copies of photographs without altering the originals."""
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re

from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SETS = {
    "街头纪实": ("street-documentary", "Street Documentary", "街角的擦肩、等候与偶遇。", "夜色中一位穿浅色衣服的人经过街边"),
    "栖身之所": ("places-we-inhabit", "Places We Inhabit", "人在城市里停留、经过、栖身。", "一个人从水泥平台跃向江边"),
    "寻常之地": ("ordinary-places", "Ordinary Places", "鱼缸、街角、窗里的光。", "两尾鱼游过水面折射出的光"),
    "风光旅拍": ("landscapes-and-travel", "Landscapes & Travel", "从窗框、江岸和树影之间看见城市与山水。", "暮色中被树影框住的城市天际线"),
    "人像写真": ("portraits", "Portraits", "目光、动作，以及人与镜头之间的距离。", "戴红围巾的人举着橙红色气球"),
}
SOURCE_TYPES = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp"}
OUTPUT = ROOT / "docs/assets/photos"
SRGB = ImageCms.createProfile("sRGB")


def save_webp(image, directory, filename, limit, quality):
    copy = image.copy()
    copy.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    copy.save(directory / filename, "WEBP", quality=quality, method=6)
    return filename, copy.width


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
        long_photo = max(image.size) >= 2.5 * min(image.size)
        preview_edge, full_edge = (1600, 4096) if long_photo else (720, 1920)
        small, small_width = save_webp(image, directory, f"{photo_id}-{preview_edge}.webp", preview_edge, 82)
        large, large_width = save_webp(image, directory, f"{photo_id}-{full_edge}.webp", full_edge, 87)
        return {
            "small": small,
            "large": large,
            "small_width": small_width,
            "large_width": large_width,
            "width": image.width,
            "height": image.height,
        }


def photo_id(path):
    if path.stem == "封面":
        return "cover"
    return re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-") or "image"


def source_albums():
    folders = {path.name: path for path in (ROOT / "摄影集").iterdir()
               if path.is_dir() and not path.name.startswith(".")}
    names = [name for name in SETS if name in folders] + sorted(folders.keys() - SETS.keys())
    if not names:
        raise ValueError("摄影集目录里没有系列文件夹。")
    for name in names:
        sources = sorted(path for path in folders[name].iterdir()
                         if path.is_file() and path.suffix.lower() in SOURCE_TYPES and not path.name.startswith("."))
        covers = [path for path in sources if path.stem == "封面"]
        if len(covers) != 1:
            raise ValueError(f"《{name}》需要恰好一张以「封面」为文件名的图片。")
        yield name, [covers[0], *(path for path in sources if path != covers[0])]


def main():
    collections = []
    albums = list(source_albums())
    for name, sources in albums:
        fallback_slug = "series-" + sha256(name.encode("utf-8")).hexdigest()[:10]
        slug, title, description, cover_alt = SETS.get(name, (fallback_slug, "", "", f"《{name}》封面"))
        directory = OUTPUT / slug
        directory.mkdir(parents=True, exist_ok=True)
        planned_names = set()
        photos = []
        for index, source in enumerate(sources, start=1):
            photo = {
                "source": source.name,
                **convert(source, directory, f"{index:02}-{photo_id(source)}"),
            }
            planned_names.update((photo["small"], photo["large"]))
            photos.append(photo)
        cover = photos[0]
        cover["alt"] = cover_alt
        if slug == "places-we-inhabit":
            for photo in photos:
                if photo["source"] == "WechatIMG2089.jpg":
                    photo["alt"] = "一辆白车驶过被树荫覆盖的道路"
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
