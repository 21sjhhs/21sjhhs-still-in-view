// Geometry ported from CupShapeMath and CupGraphic in WaterWidget, revision f9f551a.
export const defaultShape = { top: .72, middle: .62, bottom: .5, height: .92, belly: .52, curve: .05, roundness: .35 };
export const presets = {
  straight: { top: .74, middle: .74, bottom: .74, height: .72, belly: .50, curve: 0, roundness: .10 },
  wide: { top: .96, middle: .92, bottom: .64, height: .68, belly: .44, curve: .18, roundness: .58 },
  bowl: { top: .98, middle: .88, bottom: .46, height: .40, belly: .36, curve: .44, roundness: .92 },
};

export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

function radius(shape, t) {
  const upper = t <= shape.belly;
  const x = upper ? t / shape.belly : (t - shape.belly) / (1 - shape.belly);
  const start = upper ? shape.top : shape.middle;
  const end = upper ? shape.middle : shape.bottom;
  const smooth = x * x * (3 - 2 * x);
  const smoother = x ** 3 * (x * (x * 6 - 15) + 10);
  const rounded = smooth * (1 - shape.roundness) + smoother * shape.roundness;
  const blend = .35 * shape.roundness;
  const base = start + (end - start) * (x * (1 - blend) + rounded * blend);
  return clamp(base + Math.sin(Math.PI * t) * shape.curve * .1, .16, .96) / 2;
}

function integrate(shape, start) {
  const step = (1 - start) / 180;
  let sum = 0;
  let previous = radius(shape, start) ** 2;
  for (let i = 1; i <= 180; i++) {
    const current = radius(shape, start + i * step) ** 2;
    sum += (previous + current) * .5 * step;
    previous = current;
  }
  return sum;
}

export function volumeFraction(shape, fill) {
  if (fill <= 0 || fill >= 1) return clamp(fill);
  return clamp(integrate(shape, 1 - fill) / integrate(shape, 0));
}

export function milliliters(shape, fill, capacity) {
  return Math.round(capacity * volumeFraction(shape, fill));
}

export function drawCup(canvas, shape, fill, active) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const margin = height > 200 ? 0 : 14;
  const usable = Math.min(height - margin, width / (260 / 340));
  const drawingWidth = usable * (260 / 340) * .82;
  const drawingHeight = (usable - 12) * shape.height;
  const bottom = (height + usable) / 2 - 6;
  const center = width / 2;
  const top = bottom - drawingHeight;

  function outline(start = 0, count = 64) {
    const path = new Path2D();
    const edge = (t, right) => [center + (right ? 1 : -1) * drawingWidth * radius(shape, t), top + drawingHeight * t];
    path.moveTo(...edge(start, true));
    for (let i = 1; i <= count; i++) path.lineTo(...edge(start + (1 - start) * (i / count), true));
    path.quadraticCurveTo(center, bottom + drawingHeight * .05 * shape.roundness, ...edge(1, false));
    for (let i = count - 1; i >= 0; i--) path.lineTo(...edge(start + (1 - start) * (i / count), false));
    path.closePath();
    return path;
  }

  const glass = outline();
  ctx.fillStyle = "#ffffff25";
  ctx.fill(glass);
  if (fill > 0) {
    const waterline = top + drawingHeight * (1 - fill);
    const gradient = ctx.createLinearGradient(0, waterline, 0, bottom);
    gradient.addColorStop(0, "#7adbff");
    gradient.addColorStop(1, "#248fe0");
    ctx.fillStyle = gradient;
    ctx.fill(outline(1 - fill, 54));
  }
  ctx.strokeStyle = active ? "#16a9d5c9" : "#172f3c61";
  ctx.lineWidth = 2;
  ctx.stroke(glass);
}
