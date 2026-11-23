import { loadPortfolioSample, portfolioRequest } from "./portfolio-demo.js";

const state = {
  fileName: "",
  isPortfolioSample: false,
  lines: [],
  results: [],
  mode: "explain",
  activeLine: null,
  splitNote: "",
  contextFileKey: "",
  importantLines: new Set(),
  running: false,
  abortController: null,
};

const DEFAULT_EXPLAIN_PROMPT =
  "你正在逐行解释结构化纯文本中的单行。结合文件总提示词理解上下文。输出简体中文。说明这一行在当前文件结构中的作用、字段含义、关键值含义，以及它和前后结构的关系；如果这一行只是括号、逗号、数组元素、ID 或短标记，也要说明它在当前结构中的作用。不要只复述原文，不要输出 Markdown。";

const DEFAULT_TRANSLATE_PROMPT =
  "你正在逐行翻译结构化纯文本中的单行。结合文件总提示词理解上下文。目标语言为界面中的目标语言。只翻译自然语言内容；保留 JSON 键名、代码符号、ID、变量名、数据库编号、序列名、数字、标点和结构分隔符。若本行没有可翻译的自然语言，输出原文或对该标记/ID 给出极简上下文说明；不要编造，不要输出 Markdown。";

const els = {
  fileInput: document.querySelector("#fileInput"),
  fileSummary: document.querySelector("#fileSummary"),
  rows: document.querySelector("#rows"),
  runButton: document.querySelector("#runButton"),
  stopButton: document.querySelector("#stopButton"),
  exportPdfButton: document.querySelector("#exportPdfButton"),
  exportMarkdownButton: document.querySelector("#exportMarkdownButton"),
  promptToggle: document.querySelector("#promptToggle"),
  promptPanel: document.querySelector("#promptPanel"),
  generateContextButton: document.querySelector("#generateContextButton"),
  resetPromptsButton: document.querySelector("#resetPromptsButton"),
  fileContextPrompt: document.querySelector("#fileContextPrompt"),
  explainPrompt: document.querySelector("#explainPrompt"),
  translatePrompt: document.querySelector("#translatePrompt"),
  statusText: document.querySelector("#statusText"),
  progressText: document.querySelector("#progressText"),
  dropZone: document.querySelector("#dropZone"),
  apiKey: document.querySelector("#apiKey"),
  modelSelect: document.querySelector("#modelSelect"),
  concurrencyInput: document.querySelector("#concurrencyInput"),
  targetLanguage: document.querySelector("#targetLanguage"),
  segments: document.querySelectorAll(".segment"),
};

function setStatus(message, detail = "") {
  els.statusText.textContent = message;
  els.progressText.textContent = detail;
}

function setRunning(running) {
  state.running = running;
  els.runButton.disabled = running || state.lines.length === 0;
  els.fileInput.disabled = running;
  document.querySelector("#sampleButton").disabled = running;
  els.stopButton.disabled = !running;
  els.generateContextButton.disabled = running || state.lines.length === 0;
  els.exportPdfButton.disabled = running || state.lines.length === 0;
  els.exportMarkdownButton.disabled = running || state.lines.length === 0;
}

function loadPrompts() {
  els.explainPrompt.value = localStorage.getItem("linewise.explainPrompt") || DEFAULT_EXPLAIN_PROMPT;
  els.translatePrompt.value = localStorage.getItem("linewise.translatePrompt") || DEFAULT_TRANSLATE_PROMPT;
  els.fileContextPrompt.value = "";
}

function savePrompt(key, value) {
  localStorage.setItem(key, value);
}

function resetPrompts() {
  els.explainPrompt.value = DEFAULT_EXPLAIN_PROMPT;
  els.translatePrompt.value = DEFAULT_TRANSLATE_PROMPT;
  savePrompt("linewise.explainPrompt", els.explainPrompt.value);
  savePrompt("linewise.translatePrompt", els.translatePrompt.value);
  setStatus("提示词已恢复默认");
}

function getModePrompt() {
  return state.mode === "translate" ? els.translatePrompt.value.trim() : els.explainPrompt.value.trim();
}

function setPromptPanel(open) {
  els.promptPanel.hidden = !open;
  els.promptToggle.setAttribute("aria-expanded", String(open));
}

function lineCountLabel(count) {
  return `${count.toLocaleString("zh-CN")} 行`;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function getConcurrency() {
  const concurrency = clampNumber(els.concurrencyInput.value, 1, 10);
  els.concurrencyInput.value = String(concurrency);
  return concurrency;
}

function splitLines(text) {
  if (text.length === 0) return [""];
  return normalizeLineBreaks(text).split("\n");
}

function normalizeLineBreaks(text) {
  return String(text).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function jsonInline(value) {
  return JSON.stringify(value);
}

function formatPrimitiveArray(value, indent, maxLength) {
  const prefix = `${" ".repeat(indent)}[`;
  const lines = [];
  let current = prefix;

  value.forEach((item, index) => {
    const token = `${jsonInline(item)}${index === value.length - 1 ? "" : ","}`;
    const candidate = current.endsWith("[") ? `${current}${token}` : `${current} ${token}`;
    if (candidate.length > maxLength && !current.endsWith("[")) {
      lines.push(current);
      current = `${" ".repeat(indent + 2)}${token}`;
    } else {
      current = candidate;
    }
  });

  if (current.length + 1 <= maxLength) {
    lines.push(`${current}]`);
  } else {
    lines.push(current);
    lines.push(`${" ".repeat(indent)}]`);
  }

  return lines;
}

function formatJsonValue(value, indent = 0, options = {}) {
  const maxInline = options.maxInline || 520;
  const maxLine = options.maxLine || 760;
  const space = " ".repeat(indent);
  const compact = jsonInline(value);

  if (compact.length <= maxInline) return [`${space}${compact}`];

  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== "object")) {
      return formatPrimitiveArray(value, indent, maxLine);
    }

    const lines = [`${space}[`];
    value.forEach((item, index) => {
      const itemLines = formatJsonValue(item, indent + 2, options);
      if (itemLines.length === 1) {
        lines.push(`${itemLines[0]}${index === value.length - 1 ? "" : ","}`);
      } else {
        itemLines[itemLines.length - 1] += index === value.length - 1 ? "" : ",";
        lines.push(...itemLines);
      }
    });
    lines.push(`${space}]`);
    return lines;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const lines = [`${space}{`];

    entries.forEach(([key, child], index) => {
      const suffix = index === entries.length - 1 ? "" : ",";
      const childCompact = jsonInline(child);
      const keyPrefix = `${" ".repeat(indent + 2)}${JSON.stringify(key)}: `;

      if (keyPrefix.length + childCompact.length + suffix.length <= maxLine) {
        lines.push(`${keyPrefix}${childCompact}${suffix}`);
        return;
      }

      const childLines = formatJsonValue(child, indent + 2, options);
      const first = childLines[0].trimStart();
      lines.push(`${keyPrefix}${first}`);
      for (let lineIndex = 1; lineIndex < childLines.length; lineIndex += 1) {
        lines.push(childLines[lineIndex]);
      }
      lines[lines.length - 1] += suffix;
    });

    lines.push(`${space}}`);
    return lines;
  }

  return splitLongLine(`${space}${compact}`, maxLine);
}

function tryFormatJson(text) {
  const trimmed = text.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return null;

  try {
    return formatJsonValue(JSON.parse(trimmed)).join("\n");
  } catch {
    return null;
  }
}

function tryFormatJsonLines(text) {
  const rawLines = splitLines(text);
  const formatted = [];
  let parsedCount = 0;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      formatted.push("");
      continue;
    }

    if (!/^[\[{]/.test(trimmed)) return null;

    try {
      formatted.push(formatJsonValue(JSON.parse(trimmed)).join("\n"));
      parsedCount += 1;
    } catch {
      return null;
    }
  }

  return parsedCount ? formatted.join("\n") : null;
}

function wrapSequence(sequence, width = 80) {
  const chunks = [];
  for (let index = 0; index < sequence.length; index += width) {
    chunks.push(sequence.slice(index, index + width));
  }
  return chunks;
}

function tryFormatFasta(text, fileName) {
  const normalized = normalizeLineBreaks(text).trim();
  const lowerName = fileName.toLowerCase();
  const likelyFasta = /\.(fasta|fa|faa|fna|ffn|frn)$/i.test(lowerName) || normalized.startsWith(">");
  if (!likelyFasta || !normalized.startsWith(">")) return null;

  const withRecordBreaks = normalized.replace(/(?!^)>/g, "\n>");
  const output = [];

  for (const record of withRecordBreaks.split(/\n(?=>)/)) {
    const [header, ...body] = record.split("\n");
    output.push(header);

    const sequence = body.join("").replace(/\s+/g, "");
    if (sequence) output.push(...wrapSequence(sequence));
  }

  return output.join("\n");
}

function findBreakPoint(text, maxLength) {
  const minLength = Math.floor(maxLength * 0.45);
  const windowText = text.slice(0, maxLength + 1);
  const delimiters = [",", ";", "}", "]", ")", " ", "\t"];

  for (const delimiter of delimiters) {
    const index = windowText.lastIndexOf(delimiter);
    if (index >= minLength) return index + 1;
  }

  return maxLength;
}

function splitLongLine(line, maxLength = 720) {
  if (line.length <= maxLength) return [line];

  const parts = [];
  let rest = line;
  while (rest.length > maxLength) {
    const breakPoint = findBreakPoint(rest, maxLength);
    parts.push(rest.slice(0, breakPoint));
    rest = rest.slice(breakPoint);
  }

  parts.push(rest);
  return parts;
}

function prepareTextLines(text, fileName) {
  const normalized = normalizeLineBreaks(text);
  const originalLines = splitLines(normalized);
  const notes = [];
  let prepared = normalized;

  const formattedJson = tryFormatJson(normalized) || tryFormatJsonLines(normalized);
  if (formattedJson && formattedJson !== normalized) {
    prepared = formattedJson;
    notes.push("已自动格式化 JSON");
  } else {
    const formattedFasta = tryFormatFasta(normalized, fileName);
    if (formattedFasta && formattedFasta !== normalized.trim()) {
      prepared = formattedFasta;
      notes.push("已自动整理 FASTA");
    }
  }

  let lines = splitLines(prepared);
  const shouldWrap =
    originalLines.length <= 2 ||
    lines.some((line) => line.length > 1200) ||
    (lines.length <= 5 && normalized.length > 2000);

  if (shouldWrap) {
    const before = lines.length;
    lines = lines.flatMap((line) => (line.length > 900 ? splitLongLine(line) : [line]));
    if (lines.length > before) notes.push("已自动分行");
  }

  return {
    lines,
    note: [...new Set(notes)].join("，"),
  };
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderRows() {
  if (!state.lines.length) {
    els.rows.classList.add("is-empty");
    els.rows.innerHTML = `
      <div class="empty-state">
        <strong>选择一个纯文本结构化文件</strong>
        <span>.py .txt .r .fasta .csv .json .yaml .md 等</span>
      </div>
    `;
    return;
  }

  els.rows.classList.remove("is-empty");
  const html = state.lines
    .map((line, index) => {
      const result = state.results[index];
      const statusClass = result === "__RUNNING__" ? " running" : "";
      const errorClass = typeof result === "string" && result.startsWith("__ERROR__") ? " error" : "";
      const resultText =
        result === "__RUNNING__"
          ? "处理中..."
          : result?.startsWith("__ERROR__")
            ? result.replace("__ERROR__", "")
            : result ?? "";
      const placeholder = result === null || result === undefined ? " placeholder" : "";
      const activeClass = state.activeLine === line.number ? " active" : "";
      const important = state.importantLines.has(line.number);
      const importantClass = important ? " important" : "";
      const displayResult = resultText || (placeholder ? "等待输出" : "&nbsp;");

      return `
        <div class="line-row${statusClass}${errorClass}${activeClass}${importantClass}" data-line="${line.number}" tabindex="0">
          <div class="mark-cell">
            <button class="mark-button" type="button" data-line="${line.number}" aria-pressed="${important}" title="${important ? "取消重点标注" : "标注为重点"}">${important ? "★" : "☆"}</button>
          </div>
          <div class="line-no">${line.number}</div>
          <div class="source-cell">${escapeText(line.text) || "&nbsp;"}</div>
          <div class="line-no">${line.number}</div>
          <div class="result-cell${placeholder}">${displayResult === "&nbsp;" ? displayResult : escapeText(displayResult)}</div>
        </div>
      `;
    })
    .join("");

  els.rows.innerHTML = html;
}

function setActiveLine(lineNumber, scroll = false) {
  state.activeLine = Number(lineNumber);
  for (const active of els.rows.querySelectorAll(".line-row.active")) {
    active.classList.remove("active");
  }
  const row = els.rows.querySelector(`.line-row[data-line="${lineNumber}"]`);
  if (row) {
    row.classList.add("active");
    if (scroll) row.scrollIntoView({ block: "nearest" });
  }
}

function updateMode(mode) {
  state.mode = mode;
  for (const segment of els.segments) {
    segment.classList.toggle("active", segment.dataset.mode === mode);
  }
  els.targetLanguage.disabled = mode !== "translate";
  setStatus(mode === "translate" ? "翻译模式" : "解释模式");
}

async function loadFile(file, { sample = false } = {}) {
  if (state.running) return;
  const text = await file.text();
  if (state.running) return;
  const prepared = prepareTextLines(text, file.name);
  const rawLines = prepared.lines;
  state.fileName = file.name;
  state.isPortfolioSample = sample;
  state.splitNote = prepared.note;
  state.activeLine = null;
  state.contextFileKey = "";
  state.importantLines = new Set();
  state.lines = rawLines.map((line, index) => ({
    number: index + 1,
    text: line,
  }));
  state.results = Array(state.lines.length).fill(null);
  els.fileContextPrompt.value = "";

  els.fileSummary.textContent = `${file.name} · ${lineCountLabel(state.lines.length)} · ${file.size.toLocaleString("zh-CN")} bytes${state.splitNote ? ` · ${state.splitNote}` : ""}`;
  renderRows();
  setRunning(false);
  setStatus("文件已载入", `${lineCountLabel(state.lines.length)}${state.splitNote ? ` · ${state.splitNote}` : ""}`);
  setPromptPanel(true);
}

function buildContextSample() {
  const nonEmpty = state.lines.filter((line) => line.text.trim());
  const selected = new Map();
  let chars = 0;
  const maxChars = 30000;

  function add(line) {
    if (!line || selected.has(line.number) || chars >= maxChars) return;
    selected.set(line.number, line);
    chars += line.text.length;
  }

  nonEmpty.slice(0, 120).forEach(add);
  nonEmpty.slice(-60).forEach(add);

  if (nonEmpty.length > 220) {
    const step = Math.max(1, Math.floor(nonEmpty.length / 80));
    for (let index = 120; index < nonEmpty.length - 60 && chars < maxChars; index += step) {
      add(nonEmpty[index]);
    }
  }

  return [...selected.values()].sort((a, b) => a.number - b.number);
}

async function generateContextPrompt(signal) {
  if (!state.lines.length) return "";

  const response = await portfolioRequest("context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      apiKey: els.apiKey.value.trim(),
      model: els.modelSelect.value,
      targetLanguage: els.targetLanguage.value.trim() || "简体中文",
      fileName: state.fileName,
      lines: buildContextSample(),
      sample: state.isPortfolioSample,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail ? `：${data.detail}` : "";
    throw new Error(`${data.error || "生成文件总提示词失败"}${detail}`);
  }

  els.fileContextPrompt.value = data.contextPrompt || "";
  state.contextFileKey = `${state.fileName}:${state.lines.length}`;
  return els.fileContextPrompt.value.trim();
}

async function explainLine(line, signal) {
  const response = await portfolioRequest("explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      apiKey: els.apiKey.value.trim(),
      model: els.modelSelect.value,
      mode: state.mode,
      targetLanguage: els.targetLanguage.value.trim() || "简体中文",
      fileContextPrompt: els.fileContextPrompt.value.trim(),
      modePrompt: getModePrompt(),
      lines: [line],
      sample: state.isPortfolioSample,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail ? `：${data.detail}` : "";
    throw new Error(`${data.error || "请求失败"}${detail}`);
  }
  return data.items?.[0] || { line: line.number, result: "" };
}

function markLineRunning(line) {
  state.activeLine = line.number;
  state.results[line.number - 1] = "__RUNNING__";
  renderRows();
  setActiveLine(line.number, true);
}

function applyLineResult(line, item) {
  const index = line.number - 1;
  if (index >= 0 && index < state.results.length) {
    state.results[index] = String(item.result ?? "");
  }
  renderRows();
}

function applyLineError(line, error) {
  state.results[line.number - 1] = `__ERROR__${error.message}`;
  renderRows();
}

function clearRunningResults() {
  let changed = false;
  for (let index = 0; index < state.results.length; index += 1) {
    if (state.results[index] === "__RUNNING__") {
      state.results[index] = null;
      changed = true;
    }
  }
  if (changed) renderRows();
}

async function processLine(line, controller) {
  if (!line.text.trim()) {
    state.results[line.number - 1] = "";
    renderRows();
    return;
  }

  markLineRunning(line);
  const item = await explainLine(line, controller.signal);
  applyLineResult(line, item);
}

async function runDeepSeek() {
  if (!state.lines.length || state.running) return;

  const controller = new AbortController();
  state.abortController = controller;
  setRunning(true);

  let completed = 0;
  const total = state.lines.length;
  let abortedByError = false;

  try {
    if (!els.fileContextPrompt.value.trim()) {
      setStatus("生成文件总提示词", "分析文件结构");
      await generateContextPrompt(controller.signal);
    }

    if (controller.signal.aborted) {
      setStatus("已停止", "文件总提示词生成已中断");
      return;
    }

    const concurrency = Math.min(getConcurrency(), total);
    let nextIndex = 0;
    let firstError = null;
    setStatus(els.apiKey.value.trim() ? "并发请求 DeepSeek" : "回放示例结果", `0 / ${total} 行 · 并发 ${concurrency}`);

    async function worker() {
      while (!controller.signal.aborted && !firstError) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= state.lines.length) return;

        const line = state.lines[index];
        try {
          await processLine(line, controller);
          completed += 1;
          setStatus(els.apiKey.value.trim() ? "并发请求 DeepSeek" : "回放示例结果", `${completed} / ${total} 行 · 并发 ${concurrency}`);
        } catch (error) {
          if (controller.signal.aborted || error.name === "AbortError") return;
          firstError = error;
          applyLineError(line, error);
          abortedByError = true;
          controller.abort();
          return;
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (firstError) throw firstError;

    if (controller.signal.aborted) {
      setStatus("已停止", `${completed} / ${total} 行完成`);
    } else {
      setStatus(
        "完成",
        `${state.results.filter((item) => item !== null && item !== undefined && item !== "__RUNNING__").length} 行已生成`,
      );
    }
  } catch (error) {
    if ((controller.signal.aborted || error.name === "AbortError") && !abortedByError) {
      clearRunningResults();
      setStatus("已停止", `${completed} / ${total} 行完成`);
      return;
    }

    clearRunningResults();
    setStatus("发生错误", error.message);
  } finally {
    state.abortController = null;
    setRunning(false);
  }
}

function stopRun() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

function toggleImportantLine(lineNumber) {
  const number = Number(lineNumber);
  if (!Number.isInteger(number)) return;

  if (state.importantLines.has(number)) {
    state.importantLines.delete(number);
  } else {
    state.importantLines.add(number);
  }

  renderRows();
  setActiveLine(number);
  setStatus("重点标注已更新", `${state.importantLines.size} 行`);
}

function cleanResult(value) {
  if (value === null || value === undefined || value === "__RUNNING__") return "";
  const text = String(value);
  return text.startsWith("__ERROR__") ? text.replace("__ERROR__", "") : text;
}

async function handleGenerateContext() {
  if (!state.lines.length || state.running) return;

  const controller = new AbortController();
  state.abortController = controller;
  setRunning(true);
  setStatus("生成文件总提示词", "分析文件结构");

  try {
    await generateContextPrompt(controller.signal);
    setStatus("文件总提示词已生成");
    setPromptPanel(true);
  } catch (error) {
    if (controller.signal.aborted || error.name === "AbortError") {
      setStatus("已停止", "文件总提示词生成已中断");
    } else {
      setStatus("发生错误", error.message);
    }
  } finally {
    state.abortController = null;
    setRunning(false);
  }
}

function exportMarkdown() {
  const title = state.fileName || "逐行解释";
  const lines = [
    `# ${title} 逐行${state.mode === "translate" ? "翻译" : "解释"}`,
    "",
    "| 重点 | 行 | 原文 | 输出 |",
    "|:---:|---:|---|---|",
  ];

  for (const line of state.lines) {
    const result = cleanResult(state.results[line.number - 1]);
    const mark = state.importantLines.has(line.number) ? "★" : "";
    const source = line.text.replaceAll("|", "\\|").replaceAll("\n", "<br>");
    const output = String(result).replaceAll("|", "\\|").replaceAll("\n", "<br>");
    lines.push(`| ${mark} | ${line.number} | \`${source}\` | ${output} |`);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.linewise.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildPrintHtml() {
  const title = state.fileName || "逐行解释";
  const modeText = state.mode === "translate" ? "翻译" : "解释";
  const importantCount = state.importantLines.size;
  const rows = state.lines
    .map((line) => {
      const important = state.importantLines.has(line.number);
      const result = cleanResult(state.results[line.number - 1]);

      return `
        <tr class="${important ? "important" : ""}">
          <td class="mark">${important ? "★" : ""}</td>
          <td class="line-number">${line.number}</td>
          <td class="source"><pre>${escapeText(line.text)}</pre></td>
          <td class="result"><pre>${escapeText(result)}</pre></td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeText(title)} PDF</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #111;
        background: #fff;
        font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 9pt;
        line-height: 1.38;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8mm;
        align-items: end;
        margin-bottom: 5mm;
        border-bottom: 1px solid #222;
        padding-bottom: 3mm;
      }

      h1 {
        margin: 0 0 2mm;
        font-size: 15pt;
        line-height: 1.2;
      }

      .meta {
        color: #333;
        font-size: 8.5pt;
      }

      .legend {
        color: #111;
        font-size: 9pt;
        text-align: right;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      thead {
        display: table-header-group;
      }

      th,
      td {
        border: 0.35pt solid #8a938d;
        vertical-align: top;
      }

      th {
        background: #e8f0ec;
        color: #111;
        padding: 2.2mm 2mm;
        font-size: 8.5pt;
        text-align: left;
        font-weight: 700;
      }

      td {
        padding: 2mm;
      }

      tr.important td {
        background: #fff2b8;
      }

      th.mark,
      td.mark {
        width: 9mm;
        text-align: center;
        font-size: 11pt;
        color: #8a5a00;
        font-weight: 700;
      }

      th.line-number,
      td.line-number {
        width: 12mm;
        text-align: right;
        color: #333;
        font-family: Menlo, Consolas, monospace;
      }

      th.source,
      td.source {
        width: 43%;
      }

      th.result,
      td.result {
        width: auto;
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
        font-family: Menlo, Consolas, "SFMono-Regular", "Liberation Mono", monospace;
        font-size: 8pt;
        line-height: 1.34;
      }

      td.result pre {
        font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 8.5pt;
        line-height: 1.42;
      }

      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>${escapeText(title)} 逐行${modeText}</h1>
        <div class="meta">A4 横版 · 共 ${state.lines.length} 行 · 重点 ${importantCount} 行 · ${new Date().toLocaleString("zh-CN")}</div>
      </div>
      <div class="legend">★ 表示手动重点标注</div>
    </header>
    <table>
      <thead>
        <tr>
          <th class="mark">重点</th>
          <th class="line-number">行</th>
          <th class="source">原始文本</th>
          <th class="result">DeepSeek 输出</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

function exportPdf() {
  if (!state.lines.length) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setStatus("PDF 导出被浏览器拦截", "请允许弹出窗口后重试");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintHtml());
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 300);
}

els.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file) {
    loadFile(file).catch((error) => setStatus("读取失败", error.message));
  }
});

els.rows.addEventListener("mouseover", (event) => {
  const row = event.target.closest(".line-row");
  if (row) setActiveLine(row.dataset.line);
});

els.rows.addEventListener("click", (event) => {
  const markButton = event.target.closest(".mark-button");
  if (markButton) {
    event.stopPropagation();
    toggleImportantLine(markButton.dataset.line);
    return;
  }

  const row = event.target.closest(".line-row");
  if (row) setActiveLine(row.dataset.line, true);
});

els.rows.addEventListener("focusin", (event) => {
  const row = event.target.closest(".line-row");
  if (row) setActiveLine(row.dataset.line, true);
});

for (const segment of els.segments) {
  segment.addEventListener("click", () => updateMode(segment.dataset.mode));
}

els.runButton.addEventListener("click", runDeepSeek);
els.stopButton.addEventListener("click", stopRun);
els.exportPdfButton.addEventListener("click", exportPdf);
els.exportMarkdownButton.addEventListener("click", exportMarkdown);
els.promptToggle.addEventListener("click", () => setPromptPanel(els.promptPanel.hidden));
els.generateContextButton.addEventListener("click", handleGenerateContext);
els.resetPromptsButton.addEventListener("click", resetPrompts);
els.explainPrompt.addEventListener("input", () => savePrompt("linewise.explainPrompt", els.explainPrompt.value));
els.translatePrompt.addEventListener("input", () => savePrompt("linewise.translatePrompt", els.translatePrompt.value));
els.fileContextPrompt.addEventListener("input", () => {
  state.contextFileKey = "manual";
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("drag-over");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("drag-over");
  });
}

els.dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files || [];
  if (file) {
    loadFile(file).catch((error) => setStatus("读取失败", error.message));
  }
});

async function openPortfolioSample() {
  const { source, explanations } = loadPortfolioSample();
  await loadFile(new File([source], "hydration.py", { type: "text/plain" }), { sample: true });
  state.results = [...explanations];
  renderRows();
  setActiveLine(3, false);
  setPromptPanel(false);
  setStatus("已载入示例", "点击行或星标，也可切换解释 / 翻译后重新运行");
}
document.querySelector("#sampleButton").addEventListener("click", openPortfolioSample);
loadPrompts();
updateMode("explain");
openPortfolioSample();
setRunning(false);
