import {clamp, parseCube, renderPhoto, sampleLook} from "./color.js";

const workbench = document.querySelector("[data-film-demo]");
const find = selector => workbench.querySelector(selector);
const all = selector => [...workbench.querySelectorAll(selector)];
const parameters = {
  global: [
    ["brightness", "亮度", "更暗", "更亮"], ["contrast", "对比度", "柔和", "鲜明"],
    ["highlights", "高光", "压低", "提亮"], ["shadows", "阴影", "压暗", "提亮"],
    ["temperature", "白平衡", "冷", "暖"], ["tint", "色调", "偏绿", "偏洋红"],
  ],
  local: [
    ["hue", "色相", "左移", "右移"], ["saturation", "饱和度", "更淡", "更浓"],
    ["lightness", "明度", "更暗", "更亮"], ["range", "颜色范围", "更窄", "更宽"],
  ],
};
const names = {camera: "拍摄", design: "设计胶片", edit: "编辑照片"};
const builtinFiles = {warm: "warm-day", mist: "green-mist", portra_160_nc: "portra_160_nc",
  provia_400f: "provia_400f", kodachrome_25: "kodachrome_25", acros_100: "acros_100"};
const looks = Object.fromEntries(["original", ...Object.keys(builtinFiles)].map(name => [name, {}]));
const state = {mode: "camera", look: "original", ev: 0, comparing: false};
function newDraft() {
  return {group: "global", index: 0, hue: "30", recipe: {values: {}, colors: {}}, undo: [], redo: []};
}
const drafts = {design: newDraft(), edit: newDraft()};
const canvas = find("canvas");
const source = find(".instrument-source img");
const context = canvas.getContext("2d");
const parameterMenu = find(".parameter-select");
const slider = find("#demo-adjustment");
const evOutput = find("#demo-ev");
const dial = find(".ev-dial");
const guideStatus = find(".demo-status");
const picker = find(".gesture-picker");
const device = find(".film-interface");
const preview = find(".instrument-preview");
const filmStrip = find(".film-strip");
let sourceImage;
let frame;
let lookRequest = 0;
let photoRequest = 0;
let pendingEdit;
let output;

const signed = value => value > 0 ? `+${value}` : String(value);
const draft = () => drafts[state.mode];

function draw() {
  if (!sourceImage || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const config = state.mode === "camera"
      ? {...looks[state.look], ev: state.ev / 3}
      : {recipe: state.comparing ? null : draft().recipe};
    renderPhoto(sourceImage.data, output.data, config);
    context.putImageData(output, 0, 0);
    canvas.classList.add("rendered");
  });
}

async function showPhoto(button) {
  const request = ++photoRequest;
  const next = new Image();
  next.src = button.dataset.photo;
  try {
    await next.decode();
    if (request !== photoRequest) return;
    const ratio = Math.min(1, 560 / Math.max(next.naturalWidth, next.naturalHeight));
    canvas.width = Math.round(next.naturalWidth * ratio);
    canvas.height = Math.round(next.naturalHeight * ratio);
    context.drawImage(next, 0, 0, canvas.width, canvas.height);
    sourceImage = context.getImageData(0, 0, canvas.width, canvas.height);
    output = context.createImageData(canvas.width, canvas.height);
    source.src = next.src;
    source.alt = `${button.dataset.alt}，选自《${button.dataset.series}》`;
    canvas.setAttribute("aria-label", `${source.alt}，当前效果预览`);
    find("[data-photo-series]").textContent = button.dataset.series;
    all(".demo-photo").forEach(photo => photo.setAttribute("aria-pressed", String(photo === button)));
    draw();
  } catch {
    if (request === photoRequest) guideStatus.textContent = "这张作品加载失败，请重试。";
  }
}
all(".demo-photo").forEach(button => button.addEventListener("click", () => showPhoto(button)));
showPhoto(find(".demo-photo"));

function showHint(hint) {
  device.dataset.hint = hint;
  const label = find(".touch-guide-editor .touch-label");
  if (hint === "vertical") label.textContent = "上下滑，选参数";
  if (hint === "horizontal") label.textContent = "左右滑，改数值";
}

function replayHint() {
  showHint("");
  const target = state.mode === "camera" ? dial : find(".editor-gestures");
  target.scrollIntoView({block: "nearest"});
  // Restart CSS animation even when replaying the same gesture.
  requestAnimationFrame(() => requestAnimationFrame(() => showHint(state.mode === "camera" ? "dial" : "vertical")));
}
find(".replay-guide").addEventListener("click", replayHint);
const hintObserver = new IntersectionObserver(entries => {
  for (const {target, intersectionRatio} of entries) {
    device.classList.toggle(target === dial ? "dial-visible" : "editor-visible", intersectionRatio >= .45);
  }
}, {threshold: .45});
hintObserver.observe(dial);
hintObserver.observe(find(".editor-gestures"));

const ticks = Array.from({length: 19}, (_, index) => {
  const value = index - 9;
  const tick = document.createElement("span");
  tick.className = "dial-tick";
  if (value % 3 === 0) {
    tick.classList.add("major");
    const label = document.createElement("span");
    label.textContent = signed(value / 3);
    tick.append(label);
  }
  find(".dial-ticks").append(tick);
  return tick;
});

function setEv(value) {
  state.ev = clamp(Math.round(value), -9, 9);
  const display = `${signed((state.ev / 3).toFixed(1))} EV`;
  evOutput.textContent = display;
  dial.setAttribute("aria-valuenow", String(state.ev / 3));
  dial.setAttribute("aria-valuetext", display);
  ticks.forEach((tick, index) => {
    const angle = (index - 9 - state.ev) * 15;
    tick.style.transform = `rotate(${angle}deg)`;
    tick.style.visibility = Math.abs(angle) < 89 ? "" : "hidden";
    tick.classList.toggle("current", angle === 0);
  });
  draw();
}

function pointerDrag(element, onStart, onMove, onEnd = () => {}) {
  let active;
  element.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    active = onStart(event);
    if (!active) return;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", event => {
    if (active && element.hasPointerCapture(event.pointerId)) onMove(event, active);
  });
  element.addEventListener("lostpointercapture", () => {
    if (active) onEnd(active);
    active = undefined;
  });
}

function dialAngle(event, box) {
  return Math.atan2(event.clientX - box.left - box.width / 2, box.bottom - event.clientY) * 180 / Math.PI;
}

pointerDrag(dial, event => {
  const box = dial.getBoundingClientRect();
  const radius = Math.hypot(event.clientX - box.left - box.width / 2, event.clientY - box.bottom);
  if (radius < box.height * .64 || radius > box.height * 1.12) return null;
  return {box, angle: dialAngle(event, box), ev: state.ev};
}, (event, start) => {
  const angle = dialAngle(event, start.box);
  const delta = ((angle - start.angle + 540) % 360) - 180;
  if (Math.abs(delta) > 6) showHint("");
  setEv(start.ev - delta / 15);
});
dial.addEventListener("keydown", event => {
  const steps = {ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 3, PageDown: -3};
  if (!(event.key in steps) && !["Home", "End"].includes(event.key)) return;
  event.preventDefault();
  showHint("");
  setEv(event.key === "Home" ? -9 : event.key === "End" ? 9 : state.ev + steps[event.key]);
});
function setLook(look) {
  state.look = look;
  const button = find(`[data-look="${look}"]`);
  all("[data-look]").forEach(chip => chip.setAttribute("aria-pressed", String(chip === button)));
  const strip = filmStrip.getBoundingClientRect();
  const chip = button.getBoundingClientRect();
  const delta = chip.left + chip.width / 2 - strip.left - strip.width / 2;
  filmStrip.scrollTo({left: filmStrip.scrollLeft + delta});
  draw();
}

async function loadBuiltin(look) {
  const response = await fetch(new URL(`./${builtinFiles[look]}.cube`, import.meta.url));
  if (!response.ok) throw new Error("无法加载示例胶片。");
  looks[look].lut = parseCube(await response.text());
}

async function selectFilm(look) {
  const request = ++lookRequest;
  guideStatus.textContent = "";
  try {
    if (Object.hasOwn(builtinFiles, look) && !looks[look].lut) await loadBuiltin(look);
    if (request === lookRequest && state.mode === "camera") setLook(look);
  } catch {
    if (request === lookRequest) guideStatus.textContent = "无法加载示例胶片，请重试。";
  }
}
all("[data-look]").forEach(button => button.addEventListener("click", () => selectFilm(button.dataset.look)));
filmStrip.addEventListener("scrollend", () => {
  if (state.mode !== "camera") return;
  const strip = filmStrip.getBoundingClientRect();
  const center = strip.left + strip.width / 2;
  const closest = all("[data-look]").filter(button => !button.hidden).reduce((near, button) => {
    const box = button.getBoundingClientRect();
    const distance = Math.abs(center - box.left - box.width / 2);
    return distance < near.distance ? {button, distance} : near;
  }, {distance: Infinity});
  if (closest.button && closest.button.dataset.look !== state.look) selectFilm(closest.button.dataset.look);
});

function updateMode(mode) {
  const changed = state.mode !== mode;
  finishEdit();
  state.mode = mode;
  state.comparing = false;
  device.dataset.activeScreen = mode;
  if (changed) showHint(mode === "camera" ? "" : "vertical");
  closeMenu(".stage-settings", ".settings-menu");
  closeMenu(".editor-more", ".editor-menu");
  guideStatus.textContent = "";
  find("[data-screen-name]").textContent = names[mode];
  all("[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  all("[data-guide]").forEach(panel => { panel.hidden = panel.dataset.guide !== mode; });
  all("[data-camera]").forEach(node => { node.hidden = mode !== "camera"; });
  all("[data-editor]").forEach(node => { node.hidden = mode === "camera"; });
  if (mode !== "camera") {
    find(".save-edit").hidden = mode !== "edit";
    updateCompare();
    populateParameters();
  }
  draw();
}
all("[data-mode]").forEach(button => button.addEventListener("click", () => updateMode(button.dataset.mode)));

function choices() {
  return parameters[draft().group];
}

function currentValues() {
  const {group, hue, recipe} = draft();
  if (group === "global") return recipe.values;
  recipe.colors[hue] ??= {};
  return recipe.colors[hue];
}

function selectedValue() {
  return currentValues()[choices()[draft().index][0]] || 0;
}

function updateEditor() {
  const [, label, lowText, highText] = choices()[draft().index];
  const number = Math.round(selectedValue() * 100);
  parameterMenu.selectedIndex = draft().index;
  slider.value = number;
  slider.setAttribute("aria-label", label);
  find(".adjustment-value").textContent = signed(number);
  find(".value-limits span:first-child").textContent = lowText;
  find(".value-limits span:last-child").textContent = highText;
  find(".reset-adjustment").disabled = number === 0;
  find(".undo-adjustment").disabled = !draft().undo.length;
  find(".redo-adjustment").disabled = !draft().redo.length;
  if (!picker.hidden) {
    picker.replaceChildren(...choices().map(([, name], index) => {
      const option = document.createElement("span");
      option.textContent = name;
      if (index === draft().index) option.setAttribute("aria-current", "true");
      return option;
    }));
  }
  draw();
}

function populateParameters() {
  all("[data-adjustment-mode]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.adjustmentMode === draft().group));
  });
  updateSwatches();
  parameterMenu.replaceChildren(...choices().map(([key, label]) => new Option(label, key)));
  updateEditor();
}

function setAdjustment(value) {
  const next = clamp(value, -1, 1);
  if (selectedValue() === next) return;
  pendingEdit ??= structuredClone(draft().recipe);
  currentValues()[choices()[draft().index][0]] = next;
  updateEditor();
}

function finishEdit() {
  if (!pendingEdit) return;
  draft().undo.push(pendingEdit);
  draft().redo.length = 0;
  pendingEdit = undefined;
  updateEditor();
}

function restore(from, to) {
  finishEdit();
  if (!draft()[from].length) return;
  draft()[to].push(draft().recipe);
  draft().recipe = draft()[from].pop();
  updateEditor();
}
find(".undo-adjustment").addEventListener("click", () => restore("undo", "redo"));
find(".redo-adjustment").addEventListener("click", () => restore("redo", "undo"));

function updateCompare() {
  const compare = find(".demo-compare");
  compare.setAttribute("aria-pressed", String(state.comparing));
  compare.textContent = state.comparing ? "基底画面" : "对比";
  draw();
}

find(".demo-compare").addEventListener("click", () => {
  state.comparing = !state.comparing;
  updateCompare();
});
all("[data-adjustment-mode]").forEach(button => button.addEventListener("click", () => {
  draft().group = button.dataset.adjustmentMode;
  draft().index = 0;
  populateParameters();
}));
function updateSwatches() {
  find(".color-swatches").hidden = draft().group !== "local";
  all("[data-color]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.color === draft().hue));
  });
}
all("[data-color]").forEach(button => button.addEventListener("click", () => {
  draft().hue = button.dataset.color;
  updateSwatches();
  updateEditor();
}));
parameterMenu.addEventListener("change", () => {
  draft().index = parameterMenu.selectedIndex;
  updateEditor();
});
slider.addEventListener("input", () => {
  if (device.dataset.hint === "horizontal") showHint("");
  setAdjustment(Number(slider.value) / 100);
});
slider.addEventListener("change", finishEdit);
find(".reset-adjustment").addEventListener("click", () => {
  setAdjustment(0);
  finishEdit();
});

const gestures = find(".editor-gestures");
pointerDrag(gestures, event => ({
  x: event.clientX, y: event.clientY, index: draft().index, value: selectedValue(), axis: null,
}), (event, start) => {
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (!start.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
    start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (start.axis === "y" || device.dataset.hint === "horizontal") showHint("");
    picker.hidden = start.axis === "x";
  }
  if (start.axis === "x") {
    setAdjustment(start.value + 2 * dx / Math.max(gestures.clientWidth, 220));
  } else if (start.axis === "y") {
    const index = clamp(start.index - Math.round(dy / 40), 0, choices().length - 1);
    start.selected = index !== start.index;
    draft().index = index;
    updateEditor();
  }
}, gesture => {
  picker.hidden = true;
  if (gesture.selected) showHint("horizontal");
  finishEdit();
});

function downloadPhoto(config, filename, crop = false) {
  if (!sourceImage) return;
  const saved = document.createElement("canvas");
  saved.width = canvas.width;
  saved.height = canvas.height;
  const exportContext = saved.getContext("2d");
  const image = exportContext.createImageData(saved.width, saved.height);
  renderPhoto(sourceImage.data, image.data, config);
  exportContext.putImageData(image, 0, 0);
  let result = saved;
  if (crop) {
    result = document.createElement("canvas");
    result.width = Math.min(saved.width, Math.round(saved.height * 3 / 4));
    result.height = Math.min(saved.height, Math.round(saved.width * 4 / 3));
    result.getContext("2d").drawImage(saved, (saved.width - result.width) / 2,
      (saved.height - result.height) / 2, result.width, result.height, 0, 0, result.width, result.height);
  }
  result.toBlob(blob => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    guideStatus.textContent = "已导出演示照片。";
  }, "image/jpeg", .92);
}
find(".demo-shutter").addEventListener("click", () => {
  downloadPhoto({...looks[state.look], ev: state.ev / 3}, "filmcam-capture.jpg", true);
  const thumb = find(".recent-photo img");
  thumb.src = canvas.toDataURL();
  thumb.hidden = false;
});
find(".save-edit").addEventListener("click", () => downloadPhoto({recipe: draft().recipe}, "filmcam-edit.jpg"));
find(".demo-save").addEventListener("click", () => {
  finishEdit();
  ++lookRequest;
  looks.custom = {recipe: structuredClone(draft().recipe)};
  const film = find('[data-look="custom"]');
  film.hidden = false;
  updateMode("camera");
  setLook("custom");
  film.focus({preventScroll: true});
  guideStatus.textContent = "已将「我的胶片」加入胶片条，并应用到当前取景。";
});

function closeMenu(buttonSelector, menuSelector) {
  find(buttonSelector).setAttribute("aria-expanded", "false");
  find(menuSelector).hidden = true;
}
function bindMenu(buttonSelector, menuSelector) {
  const button = find(buttonSelector);
  const menu = find(menuSelector);
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  device.addEventListener("click", event => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) closeMenu(buttonSelector, menuSelector);
  });
  device.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) {
      closeMenu(buttonSelector, menuSelector);
      button.focus();
    }
  });
}
bindMenu(".stage-settings", ".settings-menu");
bindMenu(".editor-more", ".editor-menu");
all("[data-open-screen]").forEach(button => button.addEventListener("click", () => updateMode(button.dataset.openScreen)));
find(".back-camera").addEventListener("click", () => updateMode("camera"));
find("[data-credits]").addEventListener("click", () => {
  closeMenu(".stage-settings", ".settings-menu");
  find(".credits-dialog").showModal();
});
function viewPhotoLibrary() {
  closeMenu(".editor-more", ".editor-menu");
  find(".demo-photo[aria-pressed=true]").focus({preventScroll: true});
  find(".workbench-library").scrollIntoView({block: "nearest"});
}
find(".recent-photo").addEventListener("click", viewPhotoLibrary);
find(".change-photo").addEventListener("click", viewPhotoLibrary);
find(".editor-replay").addEventListener("click", () => {
  closeMenu(".editor-more", ".editor-menu");
  replayHint();
});
find(".reset-all").addEventListener("click", () => {
  closeMenu(".editor-more", ".editor-menu");
  finishEdit();
  pendingEdit = structuredClone(draft().recipe);
  draft().recipe = {values: {}, colors: {}};
  finishEdit();
});
let focusTimer;
find(".camera-overlay").addEventListener("click", event => {
  if (event.target !== event.currentTarget) return;
  const box = find(".focus-box");
  const rect = preview.getBoundingClientRect();
  box.style.left = `${event.clientX - rect.left}px`;
  box.style.top = `${event.clientY - rect.top}px`;
  box.hidden = false;
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => { box.hidden = true; }, 800);
});

const dialog = find(".lut-dialog");
const fileInput = find(".lut-file");
const lutError = find(".lut-error");
find(".open-lut").addEventListener("click", () => {
  lutError.textContent = "";
  fileInput.value = "";
  dialog.showModal();
});
function importLook(lut, name) {
  ++lookRequest;
  looks.imported = {lut};
  const film = find('[data-look="imported"]');
  film.hidden = false;
  film.textContent = name.length > 21 ? `${name.slice(0, 20)}…` : name;
  film.title = name;
  dialog.close();
  setLook("imported");
  film.focus({preventScroll: true});
  guideStatus.textContent = `已导入「${name}」，取景已应用该 LUT。`;
}
find(".sample-lut").addEventListener("click", () => importLook(sampleLook(), "暮色（示例）"));
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  lutError.textContent = "";
  try {
    if (!/\.cube$/i.test(file.name) || file.size > 24 * 1024 * 1024) {
      throw new Error("请选择 24 MB 以下的 .cube 文件。");
    }
    const lut = parseCube(await file.text());
    if (dialog.open && fileInput.files[0] === file) importLook(lut, file.name.replace(/\.cube$/i, ""));
  } catch (error) {
    if (fileInput.files[0] === file) lutError.textContent = error.message;
  }
});

setEv(0);
