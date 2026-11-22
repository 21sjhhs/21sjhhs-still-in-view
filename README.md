# Still in View

个人摄影与独立产品作品集。网站文件在 `docs/`，可直接由 GitHub Pages 提供访问。三个摄影系列使用本地原片导出的 WebP。FilmCam 产品页提供 Android 10 及以上可用的 0.5.0 APK，沿用原项目现有的 Android Debug 证书。

## 本地预览

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

浏览器打开 `http://127.0.0.1:8765/`。

## 更新作品

将照片放入 `摄影集` 下对应的系列目录。封面文件名和系列说明在 `scripts/prepare_photos.py` 中配置。Git 只包含公开网站使用的 WebP 副本，原片保留本地。

```sh
python3 -m pip install Pillow
python3 scripts/prepare_photos.py
python3 scripts/build_site.py
```

页面模板在 `scripts/build_site.py` 中，样式和灯箱脚本在 `docs/assets/`。提交更新后的 `docs/` 文件即可发布。GitHub Pages 的来源设置为 `main` 分支的 `/docs`。

## 上新产品

在 `scripts/build_site.py` 的 `PROJECTS` 中添加名称、路径和摘要。可用 `cover` 指定封面在 `docs/` 内的相对路径。然后生成 `docs/projects/<slug>/index.html`。首页和 `/projects/` 从同一份目录生成产品入口。

FilmCam 的交互演示模板在 `scripts/filmcam_demo.html`，逻辑和样式在 `docs/assets/filmcam/`。网页按 FilmCam 0.5.0 默认「放映室」主题模拟操作，可选作品由 `filmcam_photos()` 从摄影集生成，导入的 LUT 只在浏览器内读取。
