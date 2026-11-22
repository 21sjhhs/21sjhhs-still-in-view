export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function parseCube(text) {
  let size;
  let low = [0, 0, 0];
  let high = [1, 1, 1];
  let data;
  let offset = 0;
  for (const raw of text.split(/\r?\n/)) {
    const row = raw.split("#", 1)[0].trim();
    if (!row || /^TITLE\s/i.test(row)) continue;
    const [key, ...rest] = row.split(/\s+/);
    if (key === "LUT_3D_SIZE" && size === undefined && rest.length === 1) {
      size = Number(rest[0]);
      if (![17, 33, 65].includes(size)) throw new Error("请选择 17³、33³ 或 65³ 的 3D LUT。");
      data = new Float32Array(size ** 3 * 3);
      continue;
    }
    if (key === "DOMAIN_MIN" || key === "DOMAIN_MAX") {
      const range = rest.map(Number);
      if (range.length !== 3 || !range.every(Number.isFinite)) throw new Error("LUT 输入范围无效。");
      if (key === "DOMAIN_MIN") low = range;
      else high = range;
      continue;
    }
    const rgb = [key, ...rest].map(Number);
    if (!data || rgb.length !== 3 || !rgb.every(Number.isFinite) || offset >= data.length) {
      throw new Error("无法读取此 3D .cube 文件。");
    }
    data.set(rgb.map(value => clamp(value)), offset);
    offset += 3;
  }
  if (!data || offset !== data.length || !low.every((value, channel) => value < high[channel])) {
    throw new Error("LUT 的颜色数据或输入范围有误。");
  }
  return {size, data, low, high};
}

export function sampleLook() {
  const rows = ["TITLE \"暮色\"", "LUT_3D_SIZE 17"];
  for (let b = 0; b <= 16; b++) {
    for (let g = 0; g <= 16; g++) {
      for (let r = 0; r <= 16; r++) {
        const neutral = (r * .2126 + g * .7152 + b * .0722) / 16;
        rows.push([r, g, b].map((level, channel) => {
          const base = level / 16 * .62 + neutral * .38;
          return clamp(.035 + base * [.85, .89, .98][channel]).toFixed(5);
        }).join(" "));
      }
    }
  }
  return parseCube(rows.join("\n"));
}

function applyCube(lut, pixel) {
  const {size, data, low, high} = lut;
  const rx = clamp((pixel[0] - low[0]) / (high[0] - low[0])) * (size - 1);
  const gx = clamp((pixel[1] - low[1]) / (high[1] - low[1])) * (size - 1);
  const bx = clamp((pixel[2] - low[2]) / (high[2] - low[2])) * (size - 1);
  const r0 = Math.min(Math.floor(rx), size - 2);
  const g0 = Math.min(Math.floor(gx), size - 2);
  const b0 = Math.min(Math.floor(bx), size - 2);
  const dr = rx - r0;
  const dg = gx - g0;
  const db = bx - b0;
  const row = size * 3;
  const layer = size * row;
  const start = r0 * 3 + g0 * row + b0 * layer;
  for (let c = 0; c < 3; c++) {
    const k = start + c;
    const a = data[k] * (1 - dr) + data[k + 3] * dr;
    const b = data[k + row] * (1 - dr) + data[k + row + 3] * dr;
    const d = data[k + layer] * (1 - dr) + data[k + layer + 3] * dr;
    const e = data[k + layer + row] * (1 - dr) + data[k + layer + row + 3] * dr;
    pixel[c] = (a * (1 - dg) + b * dg) * (1 - db) + (d * (1 - dg) + e * dg) * db;
  }
}

function wrapHue(value) {
  return ((value % 360) + 360) % 360;
}

function hslToRgb(hue, saturation, lightness, pixel) {
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const sector = wrapHue(hue) / 30;
  const channel = phase => {
    const k = (phase + sector) % 12;
    return lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  pixel[0] = channel(0);
  pixel[1] = channel(8);
  pixel[2] = channel(4);
}

function recipeTransform({values, colors}) {
  const {brightness = 0, contrast = 0, highlights = 0, shadows = 0, temperature = 0, tint = 0} = values;
  const points = Object.entries(colors).filter(([, entry]) => Object.values(entry).some(Boolean))
    .map(([hue, entry]) => ({
      hue: Number(hue), shift: (entry.hue || 0) * 45, saturation: entry.saturation || 0,
      lightness: (entry.lightness || 0) * .3, range: 35 + (entry.range || 0) * (entry.range < 0 ? 25 : 55),
    }));
  if (![brightness, contrast, highlights, shadows, temperature, tint].some(Boolean) && !points.length) return null;
  const knots = [0, .25 + shadows * .14, .5, .75 + highlights * .14, 1];
  const delta = knots.slice(1).map((value, index) => (value - knots[index]) * 4);
  const slopes = [delta[0], ...delta.slice(1).map((value, index) => 2 / (1 / value + 1 / delta[index])), delta[3]];
  const exposure = Math.exp(-brightness * 1.2);
  const balance = [Math.exp(-.75 * temperature - .40 * tint), Math.exp(.36 * tint), Math.exp(.75 * temperature - .40 * tint)];
  return pixel => {
    const [r, g, b] = pixel;
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    const chroma = hi - lo;
    const lightness = (hi + lo) / 2;
    const saturation = chroma < 1e-7 ? 0 : chroma / Math.max(1 - Math.abs(2 * lightness - 1), 1e-7);
    let hue = 0;
    if (chroma >= 1e-7) {
      const sector = hi === r ? (g - b) / chroma : hi === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
      hue = wrapHue(sector * 60);
    }
    const l = lightness / (lightness + (1 - lightness) * exposure);
    const i = Math.min(3, Math.floor(l * 4));
    const t = l * 4 - i;
    const t2 = t * t;
    const t3 = t2 * t;
    const mapped = (2 * t3 - 3 * t2 + 1) * knots[i] + (t3 - 2 * t2 + t) * .25 * slopes[i]
      + (-2 * t3 + 3 * t2) * knots[i + 1] + (t3 - t2) * .25 * slopes[i + 1];
    const contrasted = mapped + 1.7 * contrast * mapped * (1 - mapped) * (mapped - .5);
    let total = 0;
    let dh = 0;
    let ds = 0;
    let dl = 0;
    const strength = clamp((saturation - .02) / .16);
    for (const point of points) {
      const distance = (wrapHue(hue - point.hue + 180) - 180) / point.range;
      const weight = Math.exp(-.5 * distance ** 2) * strength ** 2 * (3 - 2 * strength);
      total += weight;
      dh += weight * point.shift;
      ds += weight * point.saturation;
      dl += weight * point.lightness;
    }
    const norm = Math.max(total, 1);
    hslToRgb(hue + dh / norm, clamp(saturation * (1 + ds / norm)), clamp(contrasted + dl / norm), pixel);
    for (let c = 0; c < 3; c++) {
      pixel[c] /= pixel[c] + (1 - pixel[c]) * balance[c];
    }
  };
}

export function renderPhoto(source, target, {ev = 0, lut, recipe} = {}) {
  const scale = 2 ** (ev * .5);
  const transform = recipe && recipeTransform(recipe);
  const pixel = [0, 0, 0];
  for (let i = 0; i < source.length; i += 4) {
    for (let c = 0; c < 3; c++) pixel[c] = clamp(source[i + c] * scale / 255);
    if (lut) applyCube(lut, pixel);
    if (transform) transform(pixel);
    for (let c = 0; c < 3; c++) target[i + c] = pixel[c] * 255;
    target[i + 3] = 255;
  }
}
