// Request handlers adapted from 21sjhhs/code-reading-with-deepseek, revision 7197552.
const allowedModels = new Set([
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner",
]);

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("请求体过大。请减少分块大小后重试。"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("请求体不是合法 JSON。"));
      }
    });
    req.on("error", reject);
  });
}

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function normalizeItems(rawContent, sourceLines) {
  const parsed = JSON.parse(stripCodeFence(rawContent));
  const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(rawItems)) {
    throw new Error("DeepSeek 返回的 JSON 中缺少 items 数组。");
  }

  const byNumber = new Map();
  for (const item of rawItems) {
    const number = Number(item?.line ?? item?.number ?? item?.lineNumber);
    if (!Number.isFinite(number)) continue;
    const result = String(item?.result ?? item?.explanation ?? item?.translation ?? "");
    byNumber.set(number, result);
  }

  return sourceLines.map((line) => ({
    line: line.number,
    result: byNumber.has(line.number)
      ? byNumber.get(line.number)
      : line.text.trim()
        ? "未返回"
        : "",
  }));
}

function buildContextPrompt({ fileName, targetLanguage, lines }) {
  return [
    "请阅读这份结构化纯文本文件的代表性片段，生成一份后续逐行翻译/解释要使用的文件总提示词。",
    "必须只输出 json，格式为：",
    '{"contextPrompt":"后续逐行处理时应使用的上下文提示词"}',
    "contextPrompt 要用简体中文编写，长度控制在 600 到 1200 个汉字。",
    "必须包含：文件类型判断、可能的领域/用途、主要结构层级、重要字段或标记、术语翻译约定、ID/编号/数组/括号/标点如何处理，以及逐行处理时怎样利用上下文。",
    "不要逐行翻译样本文本，不要输出 Markdown。",
    "",
    `文件名：${fileName || "未命名文件"}`,
    `目标语言：${targetLanguage || "简体中文"}`,
    "代表性行：",
    JSON.stringify(lines),
  ].join("\n");
}

function buildLinePrompt({ mode, targetLanguage, lines, fileContextPrompt, modePrompt }) {
  const isTranslate = mode === "translate";
  const singleLine = lines.length === 1 ? lines[0] : null;
  const fallbackTask = isTranslate
    ? `结合文件总提示词，将输入行翻译为${targetLanguage || "简体中文"}。只翻译自然语言内容；保留键名、代码符号、变量名、ID、数据库编号、序列名、数字、标点和结构分隔符。`
    : "结合文件总提示词，用简体中文解释输入行在当前文件中的作用、字段含义、关键值含义和上下文关系。";

  return [
    "请处理结构化纯文本中的当前行。必须结合文件总提示词判断语境。",
    "",
    "文件总提示词：",
    fileContextPrompt || "未提供文件总提示词，请仅根据当前行和常见结构化文本规则处理。",
    "",
    "当前模式提示词：",
    modePrompt || fallbackTask,
    "",
    "必须只输出 json，格式为：",
    '{"items":[{"line":1,"result":"这一行的解释或翻译"}]}',
    "规则：",
    "1. items 的数量必须与输入行数量一致，line 必须使用输入中的 number。",
    "2. 空白行的 result 返回空字符串。",
    "3. 翻译模式不得截断、概括或省略本行可翻译内容。",
    "4. 解释模式不得只复述原文，要说明本行在当前文件中的上下文作用。",
    "5. 不要输出 Markdown、代码块或额外说明。",
    singleLine ? `当前只处理第 ${singleLine.number} 行。` : "当前输入可能包含多行，但仍须逐行返回。",
    "",
    "输入 lines：",
    JSON.stringify(lines),
  ].join("\n");
}

async function requestDeepSeek({ apiKey, model, messages, maxTokens, temperature = 0.15 }) {
  const requestBody = {
    model,
    messages,
    response_format: { type: "json_object" },
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  if (model.startsWith("deepseek-v4")) {
    requestBody.thinking = { type: "disabled" };
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(90000),
    });
  } catch (error) {
    const connectionError = new Error(`无法连接 DeepSeek API：${error.message}`);
    connectionError.statusCode = 502;
    throw connectionError;
  }

  const upstreamText = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    let detail = upstreamText;
    try {
      const parsed = JSON.parse(upstreamText);
      detail = parsed?.error?.message || parsed?.message || upstreamText;
    } catch {
      detail = upstreamText.slice(0, 500);
    }

    const apiError = new Error(`DeepSeek API 返回 ${upstreamResponse.status}`);
    apiError.statusCode = 502;
    apiError.detail = String(detail).replaceAll(apiKey, "[已隐藏]");
    throw apiError;
  }

  return JSON.parse(upstreamText);
}

function normalizeLines(rawLines) {
  return rawLines
    .map((line) => ({
      number: Number(line?.number),
      text: String(line?.text ?? ""),
    }))
    .filter((line) => Number.isInteger(line.number) && line.number > 0);
}

function validateSharedPayload({ apiKey, model }, res) {
  if (!apiKey) {
    sendJson(res, 400, {
      error: "缺少 DeepSeek API key，请在界面填写。",
    });
    return false;
  }

  if (!allowedModels.has(model)) {
    sendJson(res, 400, { error: "不支持的模型名称。" });
    return false;
  }

  return true;
}

export async function handleContext(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const apiKey = String(payload.apiKey || "").trim();
  const model = String(payload.model || "deepseek-v4-flash");
  const targetLanguage = String(payload.targetLanguage || "简体中文").trim();
  const fileName = String(payload.fileName || "").trim();
  const lines = normalizeLines(Array.isArray(payload.lines) ? payload.lines : []);

  if (!validateSharedPayload({ apiKey, model }, res)) return;

  if (!lines.length) {
    sendJson(res, 400, { error: "没有可分析的文件样本。" });
    return;
  }

  const inputChars = lines.reduce((total, line) => total + line.text.length, 0);
  const maxTokens = Math.min(4096, Math.max(1800, Math.ceil(inputChars * 0.25)));

  try {
    const data = await requestDeepSeek({
      apiKey,
      model,
      maxTokens,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "你是结构化文件分析助手。你只返回可解析 json。",
        },
        {
          role: "user",
          content: buildContextPrompt({ fileName, targetLanguage, lines }),
        },
      ],
    });

    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(stripCodeFence(content));
    const contextPrompt = String(parsed.contextPrompt || "").trim();

    if (!contextPrompt) {
      sendJson(res, 502, { error: "DeepSeek 没有生成文件总提示词。", detail: content.slice(0, 800) });
      return;
    }

    sendJson(res, 200, {
      contextPrompt,
      usage: data.usage || null,
    });
  } catch (error) {
    sendJson(res, error.statusCode || 502, {
      error: error.message,
      detail: error.detail || "",
    });
  }
}

export async function handleExplain(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const apiKey = String(payload.apiKey || "").trim();
  const model = String(payload.model || "deepseek-v4-flash");
  const mode = payload.mode === "translate" ? "translate" : "explain";
  const targetLanguage = String(payload.targetLanguage || "简体中文").trim();
  const fileContextPrompt = String(payload.fileContextPrompt || "").trim();
  const modePrompt = String(payload.modePrompt || "").trim();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];

  if (!validateSharedPayload({ apiKey, model }, res)) return;

  const normalizedLines = normalizeLines(lines);

  if (!normalizedLines.length) {
    sendJson(res, 400, { error: "没有可处理的行。" });
    return;
  }

  const messages = [
    {
      role: "system",
      content:
        "你是严谨的逐行文本解释和翻译助手。你只返回可解析 json，严格保持输入行号，不跳行、不合并行。",
    },
    {
      role: "user",
      content: buildLinePrompt({
        mode,
        targetLanguage,
        lines: normalizedLines,
        fileContextPrompt,
        modePrompt,
      }),
    },
  ];

  const inputChars = normalizedLines.reduce((total, line) => total + line.text.length, 0);
  const promptChars = fileContextPrompt.length + modePrompt.length;
  const maxTokens = Math.min(8192, Math.max(1600, Math.ceil(inputChars * (mode === "translate" ? 1.7 : 1.0)) + Math.ceil(promptChars * 0.12)));

  let content = "";
  try {
    const data = await requestDeepSeek({ apiKey, model, messages, maxTokens, temperature: 0.12 });
    content = data?.choices?.[0]?.message?.content || "";
    const items = normalizeItems(content, normalizedLines);
    sendJson(res, 200, {
      items,
      usage: data.usage || null,
    });
  } catch (error) {
    const fallback = stripCodeFence(content).trim();
    if (normalizedLines.length === 1 && fallback) {
      sendJson(res, 200, {
        items: [{ line: normalizedLines[0].number, result: fallback }],
        usage: null,
        warning: `DeepSeek 未返回标准 JSON，已使用原始文本结果：${error.message}`,
      });
      return;
    }

    sendJson(res, 502, {
      error: error.statusCode ? error.message : `DeepSeek 返回内容解析失败：${error.message}`,
      detail: error.detail || content.slice(0, 800),
    });
  }
}
