"""Render the portfolio's static pages for GitHub Pages with the standard library."""
from hashlib import sha256
from html import escape
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "docs"
COLLECTIONS = json.loads((SITE / "assets/collections.json").read_text(encoding="utf-8"))
ALBUMS = {item["slug"]: item for item in COLLECTIONS}
ORDINARY = ALBUMS.get("ordinary-places", COLLECTIONS[0])
INHABIT = ALBUMS.get("places-we-inhabit", COLLECTIONS[0])
PORTRAITS = ALBUMS.get("portraits", COLLECTIONS[0])
FILMCAM_STREET = next((photo for photo in INHABIT["photos"] if photo["source"] == "WechatIMG2089.jpg"),
                      INHABIT["cover"])
PROJECTS = (
    {
        "slug": "filmcam",
        "name": "FilmCam",
        "platform": "Android App",
        "version": "0.5.0",
        "summary": "为街头快拍设计。快门外圈调曝光，胶片色彩实时取景。",
    },
    {
        "slug": "noemorph",
        "name": "Noemorph",
        "platform": "AI Research Skill",
        "repo": "noemorph",
        "preview": ("assets/projects/noemorph-map.webp", 1440, 960),
        "demo_title": "交互知识地图",
        "demo_help": "原项目的示例图谱。可以拖动地图、缩放、筛选、搜索，也可以点开节点查看分支和来源。",
        "summary": "把一个研究问题拓展成可追溯的研究路径。",
        "description": "从问题、假设或观察出发，跨学科寻找可迁移的解释，再选出值得深挖的方向。每一轮留下的发现、来源和未决问题，都能在知识地图里继续追踪。",
        "features": (
            ("展开初始问题", "从多个角度改变观察对象、过程或抽象层次，找到原来问题框架之外的研究方向。"),
            ("选择路径深入", "分轮调查候选方向，把证据、假设与待验证的问题一起记录，未选中的分支也可回看。"),
            ("回到交互式地图", "在浏览器里搜索、筛选和展开分支，沿地图回溯来源，或导出 HTML、JSON 和 SVG。"),
        ),
        "usage": "作为 Agent Skill 安装到支持的 AI 客户端，由客户端提供模型与检索能力。仓库包含可本地打开的示例地图。",
    },
    {
        "slug": "waterwidget",
        "name": "WaterWidget",
        "platform": "macOS 桌面小组件",
        "repo": "WaterWidget",
        "preview": ("assets/projects/waterwidget.webp", 1120, 800),
        "demo_title": "喝水小组件",
        "demo_help": "跟随白色圆点试试滚轮，再去右侧编辑杯型。杯形、水位和容量参与同一套积分，计算结果随操作更新。",
        "summary": "从杯中的液面读出喝水量，随手记在桌面上。",
        "description": "一个 macOS 桌面饮水记录器。可以用预设水量快速记录，也可以按自己的杯型调节液面，让小组件根据液面的变化换算喝了多少。",
        "features": (
            ("顺手记录", "支持 50、100、250、350 和 500 mL 的常用水量，也能用鼠标滚轮微调单次记录。"),
            ("把自己的杯子设进去", "设定杯型、容量和轮廓。可以记录两次水位之间减少的体积，也可以直接把当前液面对应的体积记为本次饮水量。"),
            ("放在习惯的位置", "支持桌面模式、置顶模式和菜单栏入口。每日目标与按日期整理的记录保存在本机。"),
        ),
        "usage": "在 macOS 上可从源码运行，也可用仓库提供的脚本打包成 App。",
    },
    {
        "slug": "code-reading-with-deepseek",
        "name": "逐行解释",
        "platform": "本地阅读工具 · DeepSeek",
        "repo": "code-reading-with-deepseek",
        "preview": ("assets/projects/line-reading.webp", 1120, 640),
        "demo_title": "原文与解释",
        "demo_help": "试试逐行高亮、标星、提示词和导出。内置示例可离线回放；真实处理需要本地 Node 预览和你自己的 DeepSeek API key。",
        "summary": "左边读原文，右边看对应的解释或翻译。",
        "description": "为代码和结构化文本做的双栏阅读工具。选择一个文件后，用 DeepSeek 按行生成解释或翻译。悬停、点击或用键盘定位时，两侧会同步高亮。",
        "features": (
            ("对照着读", "逐行对应原文与解释，适合在阅读脚本或 JSON、CSV 等结构化文本时快速找回上下文。"),
            ("先理解整份文件", "可先生成全文件的上下文提示，再逐行处理。解释、翻译和上下文提示词都能单独编辑。"),
            ("留下重点", "为关键行加星标，导出 Markdown 对照文件，或通过浏览器生成 A4 横版 PDF。"),
        ),
        "usage": "网页工具在本机运行，生成解释或翻译时调用 DeepSeek API，需要配置自己的 API key。",
    },
)
FILMCAM = PROJECTS[0]


def versioned_asset(path):
    version = sha256((SITE / path).read_bytes()).hexdigest()[:12]
    return f"{path}?v={version}"


SITE_CSS = versioned_asset("assets/site.css")
WORKBENCH_CSS = versioned_asset("assets/filmcam/workbench.css")
PROJECTS_CSS = versioned_asset("assets/projects/projects.css")
GALLERY_JS = versioned_asset("assets/gallery.js")

GALLERY_ROWS = {
    "street-documentary": (
        ("WechatIMG2131.jpg",),
        ("WechatIMG2129.jpg", "1231.jpg"),
        ("WechatIMG2130.jpg",),
        ("WechatIMG2132.jpg", "WechatIMG2140.jpg"),
        ("WechatIMG2138.jpg", "WechatIMG2139.jpg"),
        ("WechatIMG2150.jpg",),
        ("WechatIMG2137.jpg",),
    ),
    "ordinary-places": (
        ("WechatIMG1896.jpg", "WechatIMG1913.jpg"),
        ("WechatIMG2104.jpg",),
        ("WechatIMG1899.jpg", "WechatIMG1900.jpg"),
        ("WechatIMG2098.jpg",),
        ("WechatIMG1894.jpg", "WechatIMG1895.jpg"),
        ("WechatIMG1897.jpg",),
        ("WechatIMG1914.jpg", "WechatIMG2099.jpg"),
        ("WechatIMG1906.jpg",),
        ("WechatIMG2128.jpg",),
        ("WechatIMG1901.jpg", "WechatIMG1905.jpg"),
        ("WechatIMG1902.jpg", "WechatIMG1903.jpg"),
        ("WechatIMG2092.jpg",),
        ("WechatIMG1942.jpg", "WechatIMG1943.jpg"),
        ("WechatIMG2127.jpg", "WechatIMG2147.jpg"),
        ("WechatIMG1915.jpg",),
        ("WechatIMG1918.jpg", "WechatIMG1919.jpg"),
        ("WechatIMG1917.jpg",),
        ("WechatIMG1941.jpg", "WechatIMG2097.jpg"),
        ("WechatIMG2143.jpg",),
        ("WechatIMG1944.jpg", "WechatIMG2100.jpg"),
        ("WechatIMG2090.jpg", "WechatIMG2093.jpg"),
        ("截屏2026-11-22 20.29.57.png",),
    ),
    "places-we-inhabit": (
        ("WechatIMG1945.jpg",),
        ("WechatIMG1956.jpg", "WechatIMG1942.jpg"),
        ("WechatIMG1943.jpg",),
        ("WechatIMG2089.jpg",),
        ("WechatIMG1949.jpg",),
        ("WechatIMG2092.jpg",),
        ("WechatIMG1950.jpg", "WechatIMG1951.jpg"),
        ("WechatIMG2091.jpg",),
        ("WechatIMG2101.jpg",),
    ),
    "landscapes-and-travel": (
        ("WechatIMG2133.jpg",),
        ("WechatIMG2123.jpg", "WechatIMG2134.jpg"),
        ("WechatIMG2144.jpg", "WechatIMG2142.jpg"),
        ("WechatIMG2146.jpg",),
        ("WechatIMG2124.jpg", "WechatIMG2153.jpg"),
        ("WechatIMG2152.jpg",),
        ("WechatIMG2147.jpg", "WechatIMG2148.jpg"),
        ("WechatIMG2149.jpg",),
        ("WechatIMG2145.jpg",),
        ("WechatIMG2151.jpg",),
        ("WechatIMG2154.jpg", "WechatIMG2156.jpg"),
        ("WechatIMG2155.jpg", "WechatIMG2157.jpg"),
    ),
    "portraits": (
        ("WechatIMG2114.jpg", "WechatIMG2111.jpg"),
        ("feng'm.jpg", "WechatIMG1909.jpg"),
        ("WechatIMG2113.jpg", "WechatIMG2115.jpg"),
        ("WechatIMG2109.jpg",),
        ("WechatIMG2110.jpg",),
        ("WechatIMG2116.jpg",),
        ("WechatIMG1910.jpg", "WechatIMG2112.jpg"),
        ("WechatIMG2117.jpg", "WechatIMG2119.jpg"),
        ("WechatIMG2118.jpg", "WechatIMG2120.jpg"),
        ("WechatIMG2121.jpg",),
        ("WechatIMG2122.jpg",),
        ("WechatIMG1933.jpg", "WechatIMG1934.jpg"),
        ("WechatIMG1908.jpg",),
    ),
}


def photograph(collection, photo, base="", *, sizes="100vw", eager=False, alt=None):
    directory = f'{base}assets/photos/{collection["slug"]}/'
    description = photo.get("alt", "") if alt is None else alt
    loading = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    small_width = photo["small_width"]
    large_width = photo["large_width"]
    if small_width < large_width:
        responsive = (f'srcset="{directory}{photo["small"]} {small_width}w, '
                      f'{directory}{photo["large"]} {large_width}w" sizes="{sizes}"')
    else:
        responsive = ""
    return (f'<img src="{directory}{photo["large"]}" {responsive} '
            f'width="{photo["width"]}" height="{photo["height"]}" {loading} decoding="async" '
            f'alt="{escape(description, quote=True)}">')


def page(title, description, contents, base="", *, current="", gallery=False, workbench=False, project_catalog=False):
    home = base or "./"
    photography = f"{base}#photography"
    projects = f"{base}#projects"
    script = f'<script src="{base}{GALLERY_JS}" defer></script>' if gallery else ""
    if workbench:
        script = (f'<link rel="stylesheet" href="{base}{WORKBENCH_CSS}">\n  '
                  f'<script type="module" src="{base}assets/filmcam/workbench.js"></script>')
    if project_catalog:
        script = f'<link rel="stylesheet" href="{base}{PROJECTS_CSS}">'
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
        <a href="{projects}"{' aria-current="true"' if current == 'projects' else ''}><strong>产品集</strong><span lang="en">Projects</span></a>
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


def collection_cards(items):
    cards = []
    for item in items:
        photo = item["cover"]
        cover = photograph(item, photo, sizes="(max-width: 560px) 90vw, (max-width: 900px) 45vw, 56vw")
        portrait = " series-portrait" if photo["width"] < photo["height"] else ""
        subtitle = f'<div class="mono" lang="en">{escape(item["title"])}</div>' if item["title"] else ""
        cards.append(f"""
    <article class="series-card{portrait}">
      <a href="photography/{item["slug"]}/">
        <div class="series-image">{cover}</div>
        <div class="series-caption"><div><h2>{escape(item["name"])}</h2>{subtitle}</div>
          <span class="mono series-count">{len(item["photos"]):02} 张 <span class="link-mark" aria-hidden="true"></span></span>
        </div>
      </a>
    </article>""")
    return "".join(cards)


def camera_art(base=""):
    scene = next((photo for photo in ORDINARY["photos"] if photo["source"] == "WechatIMG2099.jpg"),
                 ORDINARY["cover"])
    img = photograph(ORDINARY, scene, base, sizes="(max-width: 680px) 73vw, 48vw", alt="")
    return f"""<div class="camera-art" aria-hidden="true">
      <div class="viewfinder">{img}
        <div class="v-grid"></div><span class="v-target"></span>
        <div class="v-data mono"><span>FILMCAM</span><span>+0.3 EV</span></div>
        <div class="v-control mono"><span>青岚 200</span><span class="v-shutter"></span><span>1.0×</span></div>
      </div>
      <span class="view-label mono">取景示意</span>
    </div>"""


def project_art(product, base="", *, detail=False):
    if product["slug"] == "filmcam":
        return camera_art(base)
    path, width, height = product["preview"]
    loading = "" if detail else ' loading="lazy"'
    alt = f'{product["name"]} 项目演示的实际界面' if detail else ""
    return (f'<div class="project-art"><img src="{base}{path}" width="{width}" '
            f'height="{height}" alt="{alt}" decoding="async"{loading}></div>')


def project_entries():
    entries = []
    for product in PROJECTS:
        slug = product["slug"]
        cover = project_art(product)
        layout = "project-feature" if slug == "filmcam" else "project-feature project-brief"
        label = product["platform"]
        if product.get("version"):
            label += f' / {product["version"]}'
        language = ' lang="en"' if product["name"].isascii() else ""
        entries.append(f"""
      <article class="project-theme-{slug}">
        <a class="{layout}" href="projects/{slug}/">
          <div class="project-copy">
            <span class="mono project-kicker">{label}</span>
            <h3{language}>{product["name"]}</h3>
            <p>{product["summary"]}</p>
            <span class="project-link">查看产品 <span class="link-mark" aria-hidden="true"></span></span>
          </div>
          {cover}
        </a>
      </article>""")
    return "".join(entries)


def repository_project(product):
    base = "../../"
    name = product["name"]
    slug = product["slug"]
    language = ' lang="en"' if name.isascii() else ""
    repo_url = f'https://github.com/21sjhhs/{product["repo"]}'
    art = project_art(product, base, detail=True)
    features = "".join(f"<div><dt>{title}</dt><dd>{description}</dd></div>"
                       for title, description in product["features"])
    return page(f"{name} | Still in View", product["summary"], f"""
    <section class="frame product-page repository-project project-theme-{slug}">
      <a class="breadcrumb mono" href="../../#projects">首页 / 产品集</a>
      <div class="repository-hero">
        <div class="repository-intro">
          <p class="project-kicker mono">{product["platform"]}</p>
          <h1{language}>{name}<i>.</i></h1>
          <p class="repository-lead">{product["summary"]}</p>
          <p class="repository-description">{product["description"]}</p>
          <div class="repository-actions">
            <a class="repository-try" href="#project-demo">体验项目</a>
            <a class="repository-link" href="{repo_url}">GitHub 仓库 <span class="link-mark" aria-hidden="true"></span></a>
          </div>
        </div>
        <div class="repository-art">{art}</div>
      </div>
      <section class="repository-demo" id="project-demo" aria-labelledby="project-demo-title">
        <div class="repository-demo-head">
          <div><h2 id="project-demo-title">{product["demo_title"]}</h2><p>{product["demo_help"]}</p></div>
          <a class="text-link" href="./demo/">独立打开 <span class="link-mark" aria-hidden="true"></span></a>
        </div>
        <iframe class="repository-demo-frame" src="./demo/" title="{name} · {product["demo_title"]}" loading="lazy" allowfullscreen></iframe>
      </section>
      <section class="repository-features" aria-labelledby="repository-features-title">
        <h2 id="repository-features-title">使用方式</h2>
        <div>
          <dl>{features}</dl>
          <p class="repository-usage">{product["usage"]}</p>
        </div>
      </section>
    </section>""", base, current="projects", project_catalog=True)


def home():
    feature, *other_albums = COLLECTIONS
    hero = photograph(feature, feature["cover"], sizes="(max-width: 780px) 92vw, 54vw", eager=True)
    photo_count = sum(len(item["photos"]) for item in COLLECTIONS)
    other_cards = (f'<div class="series-grid frame">{collection_cards(other_albums)}</div>'
                   if other_albums else "")
    return page("Still in View | 摄影与独立创作", "摄影作品集与独立产品。", f"""
    <section id="photography" class="home-photography" aria-labelledby="hero-title">
      <div class="hero frame">
        <div class="hero-copy">
          <p class="hero-kicker mono"><span></span> 摄影集</p>
          <h1 id="hero-title" lang="en"><span>Still in</span><span>View<i>.</i></span></h1>
          <div class="hero-line"><span>{len(COLLECTIONS)} 个系列 · {photo_count} 张作品</span><div class="optical-mark" aria-hidden="true"></div></div>
        </div>
        <a class="hero-photo" href="photography/{feature["slug"]}/">
          <div class="hero-image">{hero}</div>
          <div class="hero-caption">
            <div><h2>{escape(feature["name"])}</h2><span class="mono hero-credit" lang="en">{escape(feature["title"])}</span></div>
            <span class="mono series-count">{len(feature["photos"])} 张 <span class="link-mark" aria-hidden="true"></span></span>
          </div>
        </a>
      </div>
      {other_cards}
    </section>

    <div class="projects-transition frame">
      <a class="projects-jump" href="#projects">
        <div><small class="mono" lang="en">SCROLL FOR PROJECTS</small><strong>往下看产品集</strong></div>
        <span class="projects-jump-arrow" aria-hidden="true">↓</span>
      </a>
    </div>

    <section id="projects" class="section frame" aria-labelledby="projects-title">
      <div class="section-head">
        <div><p class="mono section-label">产品集</p><h2 id="projects-title" lang="en">Built by hand<i>.</i></h2></div>
        <span class="mono section-side">{len(PROJECTS)} 个项目</span>
      </div>
      <div class="project-list">{project_entries()}
      </div>
    </section>""", project_catalog=True)


def section_redirect(section_id, title):
    target = f"../#{section_id}"
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url={target}">
  <title>{title} | Still in View</title>
</head>
<body><h1>{title}</h1><a href="{target}">打开首页{title}</a></body>
</html>"""


def is_long(photo):
    return max(photo["width"], photo["height"]) >= 2.5 * min(photo["width"], photo["height"])


def gallery_rows(item):
    remaining = {photo["source"]: photo for photo in item["photos"]}
    yield [remaining.pop(item["cover"]["source"])]
    for filenames in GALLERY_ROWS.get(item["slug"], ()):
        row = [remaining.pop(filename) for filename in filenames if filename in remaining]
        if len(row) == 2 and any(is_long(photo) for photo in row):
            yield from ([photo] for photo in row)
        elif row:
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
            long_vertical = is_long(photo) and ratio < 1
            desktop_size = f"{ratio / sum(ratios) * 82:.1f}vw" if is_pair else f"min(89vw, {print_width}px)"
            sizes = f"(max-width: 680px) 91vw, {desktop_size}"
            frame_class = "gallery-frame"
            frame_style = f"--print-width: {print_width}px"
            link_data = ""
            caption = ""
            if long_vertical:
                frame_class += " gallery-frame-long"
                frame_style += f"; --photo-ratio: {ratio:.6f}"
                sizes = f"min(91vw, 340px, {110 * ratio:.3f}svh)"
                link_data = ' data-long-vertical'
                caption = '<span class="gallery-format">长图 · 放大后可滚动</span>'
            image = photograph(item, photo, base, sizes=sizes, eager=pos == 1)
            target = f'{base}assets/photos/{slug}/{photo["large"]}'
            frames.append(f"""
        <figure class="{frame_class}" style="{frame_style}">
          <a class="photo-link" href="{target}"{link_data} aria-label="放大第 {pos} 张，共 {total} 张">{image}</a>
          <figcaption class="mono"><span>{pos:02} / {total:02}</span>{caption}<span class="link-mark" aria-hidden="true"></span></figcaption>
        </figure>""")
        rows.append(f"""
      <div class="gallery-row {layout}" style="--pair-columns: {columns}">
        {"".join(frames)}
      </div>""")
    title = f'<p lang="en" class="mono section-label">{escape(item["title"])}</p>' if item["title"] else ""
    note = f'<p>{escape(item["description"])}</p>' if item["description"] else ""
    return page(f'{item["name"]} | Still in View', item["description"] or item["name"], f"""
    <section class="frame gallery-main">
      <a class="breadcrumb mono" href="../../#photography">首页 / 摄影集</a>
      <div class="collection-head">
        <div>{title}<h1>{escape(item["name"])}</h1></div>
        <div class="collection-note">{note}<span class="mono">{total} 张作品</span></div>
      </div>
      <div class="gallery-grid">{"".join(rows)}
      </div>
      <a class="next-series" href="../{next_item["slug"]}/">
        <div><span class="mono">下一系列</span><h2>{escape(next_item["name"])}</h2></div><span class="link-mark" aria-hidden="true"></span>
      </a>
    </section>
    <dialog class="lightbox" aria-label="照片查看器">
      <div class="lightbox-bar"><span class="mono lightbox-count" aria-live="polite"></span><span class="lightbox-note" id="lightbox-note" hidden>向下滚动看完整长图</span><button type="button" class="lightbox-close" aria-label="关闭照片">×</button></div>
      <div class="lightbox-body"><img alt=""></div>
      <div class="lightbox-nav"><button type="button" data-step="-1">上一张</button><button type="button" data-step="1">下一张</button></div>
    </dialog>""", base, current="photography", gallery=True)


def filmcam_photos(base):
    selection = (
        (INHABIT, FILMCAM_STREET["source"], FILMCAM_STREET["alt"]),
        (PORTRAITS, PORTRAITS["cover"]["source"], PORTRAITS["cover"]["alt"]),
        (ORDINARY, ORDINARY["cover"]["source"], ORDINARY["cover"]["alt"]),
        (PORTRAITS, "WechatIMG1934.jpg", "蓝色水面旁的人像"),
        (INHABIT, "WechatIMG1945.jpg", "几个人坐在草地尽头，面朝水岸"),
        (ORDINARY, "WechatIMG2099.jpg", "阳光落在斜切的玻璃立面"),
    )
    thumbnails = []
    first = ""
    for item, filename, alt in selection:
        photo = next((photo for photo in item["photos"] if photo["source"] == filename), None)
        if photo is None:
            continue
        folder = f'{base}assets/photos/{item["slug"]}/'
        if not thumbnails:
            first = folder + photo["large"]
        name = escape(item["name"], quote=True)
        alt = escape(alt, quote=True)
        thumbnails.append(
            f'<button type="button" class="demo-photo" data-photo="{folder}{photo["large"]}" '
            f'data-alt="{alt}" data-series="{name}" '
            f'aria-pressed="{str(not thumbnails).lower()}" aria-label="使用《{name}》作品，{alt}">'
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
                 .replace("__PHOTO_SERIES__", escape(INHABIT["name"]))
                 .replace("__PHOTO_ALT__", escape(FILMCAM_STREET["alt"], quote=True))
                 .replace("__THUMBNAILS__", thumbnails))
    size = f"{apk.stat().st_size / (1024 ** 2):.1f}"
    street = photograph(INHABIT, FILMCAM_STREET, base, sizes="(max-width: 680px) 90vw, 51vw", eager=True)
    return page("FilmCam | Still in View", "带曝光补偿拨轮和实时胶片模拟的 Android 街头快拍相机。", f"""
    <section class="frame product-page">
      <a class="breadcrumb mono" href="../../#projects">首页 / 产品集</a>
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
          <figcaption class="mono">选自《{escape(INHABIT["name"])}》</figcaption>
        </figure>
      </div>
      {workbench}
    </section>""", base, current="projects", workbench=True)


def write(relative, content):
    dest = SITE / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(line.rstrip() for line in content.splitlines()) + "\n", encoding="utf-8")


write("index.html", home())
write("photography/index.html", section_redirect("photography", "摄影集"))
for pos, item in enumerate(COLLECTIONS):
    write(f'photography/{item["slug"]}/index.html', collection(item, COLLECTIONS[(pos + 1) % len(COLLECTIONS)]))
write("projects/index.html", section_redirect("projects", "产品集"))
write("projects/filmcam/index.html", filmcam())
for product in PROJECTS[1:]:
    write(f'projects/{product["slug"]}/index.html', repository_project(product))
