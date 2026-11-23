import { clamp, defaultShape, drawCup, milliliters, presets, volumeFraction } from "./cup.js";

const find = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "long" });
const clockFormat = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
const percent = new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 2 });
const cupInteraction = find(".cup-interaction");
const shapeControls = find("#shape-controls");
const coarsePointer = matchMedia("(pointer: coarse)");
const defaults = {
  entries: [], quickAmount: 250, goal: 2000, capacity: 350, shape: { ...defaultShape },
  fill: 1, baseline: 1, mode: "drop", level: "desktop", calibrating: false,
};
const storageKey = "still-in-view.waterwidget.v1";
let state = defaults;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved) state = { ...defaults, ...saved, shape: { ...defaultShape, ...saved.shape } };
} catch { /* The demo also works in a session with storage disabled. */ }
let activeWheel = "";
let panel = "cup";

const sliders = [
  ["top", "杯口宽度", .35, 1], ["middle", "杯身宽度", .28, 1], ["bottom", "杯底宽度", .24, 1],
  ["height", "水杯高度", .35, 1], ["belly", "杯肚位置", .25, .78],
  ["curve", "侧壁弧度", -1, 1], ["roundness", "圆润程度", 0, 1],
];

function day(date) {
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
}

function todayEntries() {
  const today = day(new Date());
  return state.entries.filter(entry => day(new Date(entry.date)) === today);
}

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* session only */ }
}

function cupReadings() {
  const fraction = volumeFraction(state.shape, state.fill);
  const current = Math.round(state.capacity * fraction);
  const baseline = milliliters(state.shape, state.baseline, state.capacity);
  const pending = state.mode === "direct" ? current : state.calibrating ? 0 : Math.max(0, baseline - current);
  return { current, baseline, pending, fraction };
}

function text(selector, value) {
  find(selector).textContent = value;
}

function pressed(el, value) {
  el.setAttribute("aria-pressed", String(value));
}

function setWheelHint(step) {
  cupInteraction.dataset.wheelHint = step;
  if (step === "done") return;
  text("#wheel-instruction", coarsePointer.matches
    ? "在杯面上上下拖动"
    : step === "select" ? "点击水杯，再滚动鼠标滚轮"
      : state.mode === "drop" && !state.calibrating ? "滚动滚轮，降低水位" : "上下滚动，调整水位");
}

function showCupPanel() {
  panel = "cup";
  find("#widget").hidden = false;
  render();
}

function buttonGroup(selector, key, value) {
  all(selector).forEach(button => pressed(button, button.dataset[key] === value));
}

function redraw() {
  drawCup(find("#cup-graphic"), state.shape, state.fill, activeWheel === "cup");
  drawCup(find("#settings-graphic"), state.shape, state.fill, true);
}

function renderHistory(entries) {
  const target = find("#history-entries");
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.textContent = "还没有记录";
    target.replaceChildren(empty);
    return;
  }

  target.replaceChildren(...[...entries].reverse().map(entry => {
    const row = document.createElement("div");
    row.className = "history-entry";
    const time = document.createElement("time");
    time.textContent = clockFormat.format(new Date(entry.date));
    const amount = document.createElement("input");
    Object.assign(amount, { type: "number", min: 1, max: 5000, value: entry.amount });
    amount.setAttribute("aria-label", "更新记录毫升数");
    amount.addEventListener("change", () => {
      entry.amount = clamp(Number(amount.value) || entry.amount, 1, 5000);
      update();
    });
    const remove = document.createElement("button");
    remove.className = "outline danger";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      state.entries = state.entries.filter(record => record.id !== entry.id);
      update();
    });
    row.append(time, amount, remove);
    return row;
  }));
}

function render() {
  const date = new Date();
  all("[data-today]").forEach(element => { element.textContent = dateFormat.format(date); });
  text("#desktop-clock", clockFormat.format(date));
  buttonGroup("[data-panel]", "panel", panel);
  buttonGroup("[data-level]", "level", state.level);
  buttonGroup("[data-mode]", "mode", state.mode);
  find("#widget").dataset.level = state.level;
  find("#manual-panel").hidden = panel !== "manual";
  find("#cup-panel").hidden = panel !== "cup";

  const entries = todayEntries();
  const last = entries.at(-1);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  text("#total", `${total} ml`);
  text("#goal-label", `目标 ${state.goal} ml`);
  text("#remaining", total >= state.goal ? "已完成今日目标" : `还差 ${state.goal - total} ml`);
  find("#progress").max = state.goal;
  find("#progress").value = Math.min(total, state.goal);
  find("#tank-fill").style.setProperty("--fill", total ? `max(8px, ${Math.min(100, total / state.goal * 100)}%)` : "0%");
  find("#goal").value = state.goal;
  text("#quick-amount", state.quickAmount);
  find("#log-amount").disabled = state.quickAmount === 0;
  find("#undo").disabled = entries.length === 0;
  all("[data-clear]").forEach(button => { button.disabled = !entries.length; });
  text("#record-count", entries.length);
  text("#small-count", `${entries.length} 条`);
  text("#last-entry", last ? `${clockFormat.format(new Date(last.date))}  +${last.amount} ml` : "还没有记录");
  pressed(find("#amount-wheel"), activeWheel === "quick");

  const { current, baseline, pending, fraction } = cupReadings();
  find("#calibrate").hidden = state.mode === "direct";
  pressed(find("#calibrate"), state.calibrating);
  text("#calibrate b", state.calibrating ? "设定液面：开" : "设定液面：关");
  text("#calibrate small", state.calibrating ? "不可记录" : "可喝水");
  pressed(find("#cup-wheel"), activeWheel === "cup");
  text("#cup-amount", `${current} ml`);
  text("#basis-label", state.mode === "drop" ? "基准" : "容量");
  text("#basis", state.mode === "drop" ? baseline : state.capacity);
  text("#in-cup", current);
  text("#pending", pending);
  text("#calculation", state.calibrating
    ? "设定中：关闭开关后，以当前液面作为基准。"
    : state.mode === "drop"
      ? "本次饮水量是基准与当前杯中水量的差。"
      : "当前杯中水量就是本次饮水量，记录后液面清零。");
  find("#log-cup").disabled = !pending || state.calibrating;
  text("#settings-capacity", `${state.capacity} ml`);
  find("#capacity").value = state.capacity;
  all("[data-preset]").forEach(button => {
    const preset = presets[button.dataset.preset];
    pressed(button, sliders.every(([key]) => state.shape[key] === preset[key]));
  });
  text("#integral-height", percent.format(state.fill));
  text("#integral-volume", `${state.capacity} ml × ${percent.format(fraction)} ≈ ${current} ml`);
  text("#integral-mode", state.calibrating ? "正在校准基准液面，结束校准后才能记录。"
    : state.mode === "drop" ? `液面下降：${baseline} − ${current} = ${pending} ml。`
      : `直接水量：记录当前 ${current} ml 后，液面清零。`);
  for (const [key] of sliders) {
    find(`#shape-${key}`).value = state.shape[key];
    text(`#value-${key}`, state.shape[key].toFixed(2));
  }
  text("#history-total", total);
  text("#history-goal", state.goal);
  text("#history-count", entries.length);
  if (find("#history-dialog").open) renderHistory(entries);
  redraw();
}

function update() {
  persist();
  render();
}

function add(amount) {
  if (amount > 0) state.entries.push({ id: crypto.randomUUID(), date: Date.now(), amount });
}

function adjustWheel(kind, delta) {
  if (!delta) return;
  const force = Math.max(1, Math.abs(delta));
  if (kind === "quick") {
    state.quickAmount = clamp(state.quickAmount + Math.sign(delta) * clamp(Math.round(force ** 2 / 6), 1, 100), 0, 5000);
  } else {
    setWheelHint("done");
    const shift = clamp(force ** 2 / 1600, .004, .055);
    const direction = state.mode === "drop" && !state.calibrating ? -1 : Math.sign(delta);
    state.fill = clamp(state.fill + shift * direction);
  }
  update();
}

function bindWheel(selector, kind) {
  const button = find(selector);
  button.addEventListener("click", () => {
    activeWheel = kind;
    if (kind === "cup" && cupInteraction.dataset.wheelHint === "select") setWheelHint("scroll");
    render();
  });
  button.addEventListener("wheel", event => {
    if (activeWheel !== kind) return;
    event.preventDefault();
    adjustWheel(kind, -event.deltaY / (event.deltaMode === 0 ? 6 : 1));
  }, { passive: false });
  button.addEventListener("keydown", event => {
    const direction = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    activeWheel = kind;
    adjustWheel(kind, direction * (event.shiftKey ? 12 : 3));
  });
  let y = null;
  button.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") return;
    y = event.clientY;
    activeWheel = kind;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointermove", event => {
    if (y === null || !button.hasPointerCapture(event.pointerId) || Math.abs(y - event.clientY) < 5) return;
    adjustWheel(kind, y - event.clientY);
    y = event.clientY;
  });
  button.addEventListener("lostpointercapture", () => { y = null; });
}

for (const [key, label, min, max] of sliders) {
  const section = document.createElement("label");
  section.className = "shape-control";
  const caption = document.createElement("span");
  caption.className = "shape-label";
  caption.textContent = label;
  const value = document.createElement("output");
  value.id = `value-${key}`;
  caption.append(value);
  const slider = document.createElement("input");
  Object.assign(slider, { id: `shape-${key}`, type: "range", min, max, step: .01 });
  slider.setAttribute("aria-label", label);
  slider.addEventListener("input", () => {
    shapeControls.dataset.shapeHint = "done";
    state.shape[key] = Number(slider.value);
    update();
  });
  const track = document.createElement("span");
  track.className = "shape-track";
  track.append(slider);
  if (key === "top") {
    const dot = document.createElement("span");
    dot.className = "gesture-dot";
    dot.setAttribute("aria-hidden", "true");
    track.append(dot);
  }
  section.append(caption, track);
  shapeControls.append(section);
}

all("[data-panel]").forEach(button => button.addEventListener("click", () => {
  panel = button.dataset.panel;
  activeWheel = "";
  render();
}));
all("[data-level]").forEach(button => button.addEventListener("click", () => {
  state.level = button.dataset.level;
  update();
}));
all("[data-mode]").forEach(button => button.addEventListener("click", () => {
  if (state.mode === button.dataset.mode) return;
  state.mode = button.dataset.mode;
  state.calibrating = false;
  if (state.mode === "drop") state.baseline = state.fill;
  setWheelHint(activeWheel === "cup" ? "scroll" : "select");
  update();
}));
all("[data-quick]").forEach(button => button.addEventListener("click", () => {
  add(Number(button.dataset.quick));
  update();
}));
all("[data-adjust]").forEach(button => button.addEventListener("click", () => {
  state.quickAmount = clamp(state.quickAmount + Number(button.dataset.adjust), 0, 5000);
  update();
}));
all("[data-refill]").forEach(button => button.addEventListener("click", () => {
  state.fill = state.baseline = 1;
  activeWheel = "";
  update();
}));
all("[data-preset]").forEach(button => button.addEventListener("click", () => {
  state.shape = { ...presets[button.dataset.preset] };
  update();
}));
all("[data-history]").forEach(button => button.addEventListener("click", () => {
  find("#history-dialog").showModal();
  render();
}));
all("[data-clear]").forEach(button => button.addEventListener("click", () => {
  const today = day(new Date());
  state.entries = state.entries.filter(entry => day(new Date(entry.date)) !== today);
  update();
}));
all("[data-hide]").forEach(button => button.addEventListener("click", () => { find("#widget").hidden = true; }));
find("#reopen").addEventListener("click", () => { find("#widget").hidden = false; render(); });
find("#goal").addEventListener("change", event => {
  state.goal = clamp(Number(event.target.value) || state.goal, 500, 6000);
  update();
});
find("#capacity").addEventListener("change", event => {
  state.capacity = clamp(Number(event.target.value) || state.capacity, 50, 5000);
  update();
});
find("#log-amount").addEventListener("click", () => {
  add(state.quickAmount);
  activeWheel = "";
  update();
});
find("#undo").addEventListener("click", () => {
  const last = todayEntries().at(-1);
  if (last) state.entries = state.entries.filter(entry => entry.id !== last.id);
  update();
});
find("#calibrate").addEventListener("click", () => {
  state.calibrating = !state.calibrating;
  if (!state.calibrating) state.baseline = state.fill;
  activeWheel = state.calibrating ? "cup" : "";
  if (state.calibrating) setWheelHint("scroll");
  update();
});
find("#log-cup").addEventListener("click", () => {
  const { pending } = cupReadings();
  if (!pending || state.calibrating) return;
  add(pending);
  if (state.mode === "direct") state.fill = 0;
  state.baseline = state.fill;
  activeWheel = "";
  update();
});
find("#open-settings").addEventListener("click", () => {
  find("#settings-title").focus({ preventScroll: true });
  find("#cup-settings").scrollIntoView({ block: "nearest" });
});
find("#replay-wheel").addEventListener("click", () => {
  activeWheel = "";
  setWheelHint("done");
  showCupPanel();
  requestAnimationFrame(() => requestAnimationFrame(() => setWheelHint("select")));
});

const hintObserver = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) target.classList.toggle("hint-visible", isIntersecting);
}, { threshold: .35 });
hintObserver.observe(cupInteraction);
hintObserver.observe(shapeControls);
coarsePointer.addEventListener("change", () => setWheelHint(cupInteraction.dataset.wheelHint));
setWheelHint("select");

const frame = window.frameElement;
if (frame?.classList.contains("repository-demo-frame")) {
  const desktop = find(".desktop-space");
  const menu = find(".menu-bar");
  const size = new ResizeObserver(() => {
    const next = `${Math.max(480, Math.ceil(desktop.getBoundingClientRect().height + menu.getBoundingClientRect().height))}px`;
    if (frame.style.height !== next) frame.style.height = next;
  });
  size.observe(desktop);
  size.observe(menu);
}

bindWheel("#amount-wheel", "quick");
bindWheel("#cup-wheel", "cup");
window.addEventListener("resize", redraw);
setInterval(render, 60000);
render();
