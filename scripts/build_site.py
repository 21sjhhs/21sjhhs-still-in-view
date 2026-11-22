"""Render the portfolio's static pages for GitHub Pages with the standard library."""
from hashlib import sha256
from html import escape
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "docs"
COLLECTIONS = json.loads((SITE / "assets/collections.json").read_text(encoding="utf-8"))
ORDINARY, INHABIT, PORTRAITS = COLLECTIONS
HERO = next(photo for photo in INHABIT["photos"] if photo["source"] == "WechatIMG2089.jpg")
PROJECTS = (
    {
        "slug": "filmcam",
        "name": "FilmCam",
        "platform": "Android App",
        "version": "0.5.0",
        "summary": "为街头快拍设计。快门外圈调曝光，胶片色彩实时取景。",
    },
)
FILMCAM = PROJECTS[0]


def versioned_css(path):
    version = sha256((SITE / path).read_bytes()).hexdigest()[:12]
    return f"{path}?v={version}"


SITE_CSS = versioned_css("assets/site.css")
WORKBENCH_CSS = versioned_css("assets/filmcam/workbench.css")

GALLERY_ROWS = {
    "ordinary-places": (
        ("WechatIMG1898.jpg",),
        ("WechatIMG1896.jpg", "WechatIMG1913.jpg"),
        ("WechatIMG2104.jpg",),
        ("WechatIMG1899.jpg", "WechatIMG1900.jpg"),
        ("WechatIMG2098.jpg",),
        ("WechatIMG1894.jpg", "WechatIMG1895.jpg"),
        ("WechatIMG1897.jpg",),
        ("WechatIMG1914.jpg", "WechatIMG2099.jpg"),
        ("WechatIMG1906.jpg",),
        ("WechatIMG1901.jpg", "WechatIMG1905.jpg"),
        ("WechatIMG1902.jpg", "WechatIMG1903.jpg"),
        ("WechatIMG2092.jpg",),
        ("WechatIMG1942.jpg", "WechatIMG1943.jpg"),
        ("WechatIMG1915.jpg",),
        ("WechatIMG1918.jpg", "WechatIMG1919.jpg"),
        ("WechatIMG1917.jpg",),
        ("WechatIMG1941.jpg", "WechatIMG2097.jpg"),
        ("WechatIMG1944.jpg", "WechatIMG2100.jpg"),
        ("WechatIMG2090.jpg", "WechatIMG2093.jpg"),
        ("截屏2026-11-22 20.29.57.png",),
    ),
    "places-we-inhabit": (
        ("WechatIMG1945.jpg",),
        ("WechatIMG1956.jpg", "WechatIMG1942.jpg"),
        ("WechatIMG1943.jpg",),
        ("WechatIMG2089.jpg",),
        ("WechatIMG1949.jpg", "WechatIMG2096.jpg"),
        ("WechatIMG2092.jpg",),
        ("WechatIMG1950.jpg", "WechatIMG1951.jpg"),
        ("WechatIMG2091.jpg", "WechatIMG2095.jpg"),
        ("WechatIMG2101.jpg",),
    ),
    "portraits": (
        ("WechatIMG1935.jpg",),
        ("WechatIMG1907.jpg", "WechatIMG1909.jpg"),
        ("WechatIMG1910.jpg",),
        ("WechatIMG1911.jpg",),
        ("WechatIMG1908.jpg",),
        ("WechatIMG1933.jpg", "WechatIMG1934.jpg"),
    ),
}


def photograph(collection, photo, base="", *, sizes="100vw", eager=False, alt=None):
    directory = f'{base}assets/photos/{collection["slug"]}/'
    description = photo.get("alt", "") if alt is None else alt
    loading = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    max_edge = max(photo["width"], photo["height"])
    if max_edge > 720:
        small_width = round(photo["width"] * 720 / max_edge)
        large_width = round(photo["width"] * min(max_edge, 1920) / max_edge)
        responsive = (f'srcset="{directory}{photo["small"]} {small_width}w, '
                      f'{directory}{photo["large"]} {large_width}w" sizes="{sizes}"')
    else:
        responsive = ""
    return (f'<img src="{directory}{photo["large"]}" {responsive} '
            f'width="{photo["width"]}" height="{photo["height"]}" {loading} decoding="async" '
            f'alt="{escape(description, quote=True)}">')


def page(title, description, contents, base="", *, current="", gallery=False, workbench=False):
    home = base or "./"
    photography = f"{base}photography/"
    projects = f"{base}projects/"
    script = f'<script src="{base}assets/gallery.js" defer></script>' if gallery else ""
    if workbench:
        script = (f'<link rel="stylesheet" href="{base}{WORKBENCH_CSS}">\n  '
                  f'<script type="module" src="{base}assets/filmcam/workbench.js"></script>')
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{escape(description, quote=True)}">
  <meta name="theme-color" content="#efeee9">
  <title>{escape(title)}</title>
  <link rel="icon" href="{base}assets/mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="{base}{SITE_CSS}">
  {script}
</head>
<body>
  <a class="skip" href="#main">跳至正文</a>
  <header class="site-header">
    <div class="header-inner frame">
      <a class="brand" href="{home}" aria-label="Still in View 首页"><span class="mark" aria-hidden="true"></span><span>STILL<br>IN VIEW.</span></a>
      <nav aria-label="板块导航">
        <a href="{photography}"{' aria-current="true"' if current == 'photography' else ''}><strong>摄影集</strong><span lang="en">Photography</span></a>
        <a href="{projects}"{' aria-current="true"' if current == 'projects' else ''}><strong>产品</strong><span lang="en">Projects</span></a>
      </nav>
    </div>
  </header>
  <main id="main">
{contents}
  </main>
  <footer class="site-footer frame"><a href="{home}" lang="en">STILL IN VIEW.</a><span>摄影与独立创作</span><a href="#main">回到顶部</a></footer>
</body>
</html>
"""


def collection_cards(base="", prefix="photography/"):
    cards = []
    for item in COLLECTIONS:
        cover = photograph(item, item["cover"], base, sizes="(max-width: 680px) 90vw, 33vw")
        cards.append(f"""
    <article class="series-card">
      <a href="{prefix}{item["slug"]}/">
        <div class="series-image">{cover}</div>
        <div class="series-caption"><div><h3>{item["name"]}</h3><div class="mono" lang="en">{item["title"]}</div></div>
          <span class="mono series-count">{len(item["photos"]):02} 张 <span class="link-mark" aria-hidden="true"></span></span>
        </div>
      </a>
    </article>""")
    return "".join(cards)


def camera_art(base=""):
    scene = next(photo for photo in ORDINARY["photos"] if photo["source"] == "WechatIMG2099.jpg")
    img = photograph(ORDINARY, scene, base, sizes="(max-width: 680px) 73vw, 48vw", alt="")
    return f"""<div class="camera-art" aria-hidden="true">
      <div class="viewfinder">{img}
        <div class="v-grid"></div><span class="v-target"></span>
        <div class="v-data mono"><span>FILMCAM</span><span>+0.3 EV</span></div>
        <div class="v-control mono"><span>青岚 200</span><span class="v-shutter"></span><span>1.0×</span></div>
      </div>
      <span class="view-label mono">取景示意</span>
    </div>"""


def project_entries(base="", prefix="projects/"):
    entries = []
    for product in PROJECTS:
        cover = ""
        if product["slug"] == "filmcam":
            cover = camera_art(base)
        elif product.get("cover"):
            src = escape(base + product["cover"], quote=True)
            cover = f'<div class="project-poster"><img src="{src}" alt="" loading="lazy"></div>'
        layout = "project-feature" if cover else "project-feature project-text-only"
        entries.append(f"""
      <article>
        <a class="{layout}" href="{prefix}{product["slug"]}/">
          <div class="project-copy">
            <span class="mono project-kicker">{product["platform"]} / {product["version"]}</span>
            <h3 lang="en">{product["name"]}</h3>
            <p>{product["summary"]}</p>
            <span class="project-link">查看产品 <span class="link-mark" aria-hidden="true"></span></span>
          </div>
          {cover}
        </a>
      </article>""")
    return "".join(entries)


def project_index():
    return page("独立产品 | Still in View", "Vibe coding 独立产品。", f"""
    <section class="section frame inner-index project-index">
      <div class="section-head">
        <div><p class="mono section-label">独立产品</p><h1 lang="en">Projects<i>.</i></h1></div>
        <span class="mono section-side" lang="en">VIBE CODING</span>
      </div>
      <div class="project-list">{project_entries("../", "./")}
      </div>
    </section>""", "../", current="projects")


def home():
    hero = photograph(INHABIT, HERO, sizes="(max-width: 780px) 94vw, 56vw", eager=True)
    return page("Still in View | 摄影与独立创作", "摄影作品集与独立产品。", f"""
    <section class="hero frame" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="hero-kicker mono"><span></span> 摄影与独立创作</p>
        <h1 id="hero-title" lang="en"><span>Still in</span><span>View<i>.</i></span></h1>
        <div class="hero-line"><span>看见，也动手做。</span><div class="optical-mark" aria-hidden="true"></div></div>
      </div>
      <a class="hero-photo" href="photography/places-we-inhabit/">
        <div class="hero-image">{hero}</div>
        <div class="hero-caption mono"><span>选自《栖身之所》</span><span class="hero-credit" lang="en">PLACES WE INHABIT</span><span class="link-mark" aria-hidden="true"></span></div>
      </a>
    </section>

    <section id="photography" class="section frame" aria-labelledby="photography-title">
      <div class="section-head">
        <div><p class="mono section-label">摄影集</p><h2 id="photography-title" lang="en">Photographs</h2></div>
        <a class="text-link" href="photography/">全部系列 <span class="link-mark" aria-hidden="true"></span></a>
      </div>
      <div class="series-grid">{collection_cards()}
      </div>
    </section>

    <section id="projects" class="section frame" aria-labelledby="projects-title">
      <div class="section-head">
        <div><p class="mono section-label">独立产品</p><h2 id="projects-title" lang="en">Built by hand<i>.</i></h2></div>
        <a class="text-link" href="projects/">全部产品 <span class="link-mark" aria-hidden="true"></span></a>
      </div>
      <div class="project-list">{project_entries()}
      </div>
    </section>""")


def archive():
    return page("摄影集 | Still in View", "寻常之地、栖身之所、人像写真。", f"""
    <section class="section frame inner-index">
      <div class="section-head">
        <div><p class="mono section-label">摄影集</p><h1 lang="en">Photographs<i>.</i></h1></div>
        <span class="mono section-side">{len(COLLECTIONS)} 个系列 · {sum(len(c["photos"]) for c in COLLECTIONS)} 张作品</span>
      </div>
      <div class="series-grid">{collection_cards("../", "./")}
      </div>
    </section>""", "../", current="photography")


def gallery_rows(item):
    remaining = {photo["source"]: photo for photo in item["photos"]}
    for filenames in GALLERY_ROWS.get(item["slug"], ()):
        row = [remaining.pop(filename) for filename in filenames if filename in remaining]
        if row:
            yield row
    for photo in remaining.values():
        yield [photo]


def collection(item, next_item):
    slug = item["slug"]
    base = "../../"
    total = len(item["photos"])
    rows = []
    pos = 0
    for row in gallery_rows(item):
        ratios = [photo["width"] / photo["height"] for photo in row]
        is_pair = len(row) == 2
        layout = "gallery-pair" if is_pair else "gallery-single"
        columns = " ".join(f"minmax(0,{ratio:.6f}fr)" for ratio in ratios)
        frames = []
        for photo, ratio in zip(row, ratios):
            pos += 1
            print_width = round(min(1100, max(400, ratio * 670)))
            desktop_size = f"{ratio / sum(ratios) * 82:.1f}vw" if is_pair else f"min(89vw, {print_width}px)"
            image = photograph(item, photo, base, sizes=f"(max-width: 680px) 91vw, {desktop_size}", eager=pos == 1)
            target = f'{base}assets/photos/{slug}/{photo["large"]}'
            frames.append(f"""
        <figure class="gallery-frame" style="--print-width: {print_width}px">
          <a class="photo-link" href="{target}" aria-label="放大第 {pos} 张，共 {total} 张">{image}</a>
          <figcaption class="mono"><span>{pos:02} / {total:02}</span><span class="link-mark" aria-hidden="true"></span></figcaption>
        </figure>""")
        rows.append(f"""
      <div class="gallery-row {layout}" style="--pair-columns: {columns}">
        {"".join(frames)}
      </div>""")
    return page(f'{item["name"]} | Still in View', item["description"], f"""
    <section class="frame gallery-main">
      <a class="breadcrumb mono" href="../">摄影集 / 全部系列</a>
      <div class="collection-head">
        <div><p lang="en" class="mono section-label">{item["title"]}</p><h1>{item["name"]}</h1></div>
        <div class="collection-note"><p>{item["description"]}</p><span class="mono">{total} 张作品</span></div>
      </div>
      <div class="gallery-grid">{"".join(rows)}
      </div>
      <a class="next-series" href="../{next_item["slug"]}/">
        <div><span class="mono">下一系列</span><h2>{next_item["name"]}</h2></div><span class="link-mark" aria-hidden="true"></span>
      </a>
    </section>
    <dialog class="lightbox" aria-label="照片查看器">
      <div class="lightbox-bar"><span class="mono lightbox-count" aria-live="polite"></span><button type="button" class="lightbox-close" aria-label="关闭照片">×</button></div>
      <div class="lightbox-body"><img alt=""></div>
      <div class="lightbox-nav"><button type="button" data-step="-1">上一张</button><button type="button" data-step="1">下一张</button></div>
    </dialog>""", base, current="photography", gallery=True)


def filmcam_photos(base):
    selection = (
        (INHABIT, "WechatIMG2089.jpg", "树荫下驶过的白车"),
        (PORTRAITS, "WechatIMG1935.jpg", "举着红气球的人像"),
        (ORDINARY, "WechatIMG1898.jpg", "鱼缸里的两尾鱼"),
        (PORTRAITS, "WechatIMG1934.jpg", "蓝色水面旁的人像"),
        (INHABIT, "WechatIMG1945.jpg", "几个人坐在草地尽头，面朝水岸"),
        (ORDINARY, "WechatIMG2099.jpg", "阳光落在斜切的玻璃立面"),
    )
    thumbnails = []
    first = ""
    for index, (item, filename, alt) in enumerate(selection):
        photo = next(photo for photo in item["photos"] if photo["source"] == filename)
        folder = f'{base}assets/photos/{item["slug"]}/'
        if index == 0:
            first = folder + photo["large"]
        thumbnails.append(
            f'<button type="button" class="demo-photo" data-photo="{folder}{photo["large"]}" '
            f'data-alt="{escape(alt, quote=True)}" data-series="{item["name"]}" '
            f'aria-pressed="{str(index == 0).lower()}" aria-label="使用《{item["name"]}》作品，{alt}">'
            f'<img src="{folder}{photo["small"]}" alt="" decoding="async" loading="lazy"></button>'
        )
    return first, "\n".join(thumbnails)


def filmcam():
    base = "../../"
    version = FILMCAM["version"]
    apk = SITE / f"assets/filmcam/FilmCam-{version}.apk"
    demo_photo, thumbnails = filmcam_photos(base)
    workbench = (Path(__file__).with_name("filmcam_demo.html").read_text(encoding="utf-8")
                 .replace("__PHOTO__", demo_photo)
                 .replace("__THUMBNAILS__", thumbnails))
    size = f"{apk.stat().st_size / (1024 ** 2):.1f}"
    street = photograph(INHABIT, HERO, base, sizes="(max-width: 680px) 90vw, 51vw", eager=True)
    return page("FilmCam | Still in View", "带曝光补偿拨轮和实时胶片模拟的 Android 街头快拍相机。", f"""
    <section class="frame product-page">
      <a class="breadcrumb mono" href="../">产品 / 全部产品</a>
      <div class="project-feature product-hero">
        <div class="project-copy">
          <span class="mono project-kicker">ANDROID APP / {version}</span>
          <img class="app-icon" src="{base}assets/filmcam/icon.png" width="60" height="60" alt="">
          <h1 lang="en">FilmCam<i>.</i></h1>
          <p class="film-tagline">面向街头摄影的快拍相机。</p>
          <div class="film-pillars">
            <div><strong>曝光补偿拨轮</strong><span>转动快门外圈，即刻压暗或提亮。</span></div>
            <div><strong>实时胶片模拟</strong><span>拍摄前就看见胶片色彩，也能导入 LUT 或自制配方。</span></div>
          </div>
          <div class="hero-product-links"><a class="download" href="{base}assets/filmcam/{apk.name}" download>下载 Android APK <span class="link-mark" aria-hidden="true"></span></a>
          <a class="product-link-demo" href="#filmcam-demo">试玩交互演示</a></div>
          <div class="mono release-note">Android 10 及以上 · {size} MB</div>
        </div>
        <figure class="film-street">
          {street}
          <figcaption class="mono">选自《栖身之所》</figcaption>
        </figure>
      </div>
      {workbench}
    </section>""", base, current="projects", workbench=True)


def write(relative, content):
    dest = SITE / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(line.rstrip() for line in content.splitlines()) + "\n", encoding="utf-8")


write("index.html", home())
write("photography/index.html", archive())
for pos, item in enumerate(COLLECTIONS):
    write(f'photography/{item["slug"]}/index.html', collection(item, COLLECTIONS[(pos + 1) % len(COLLECTIONS)]))
write("projects/index.html", project_index())
write("projects/filmcam/index.html", filmcam())
