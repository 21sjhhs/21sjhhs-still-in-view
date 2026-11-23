const lines = [
  ["# Record each glass in millilitres.", "注释说明列表里的数值以毫升为单位。", "# 以毫升记录每杯饮水量。"],
  ["cups = [250, 350, 100]", "将三次饮水记录放进列表 cups。", "cups = [250, 350, 100]"],
  ["total = sum(cups)", "调用 sum 对列表求和，得到 700 mL。", "total = sum(cups)"],
  ["target = 2000", "设置当天的饮水目标为 2000 mL。", "target = 2000"],
  ["remaining = max(0, target - total)", "从目标减去已喝水量，超过目标时把剩余量保持为 0。", "remaining = max(0, target - total)"],
  ["print(total, remaining)", "输出已喝和剩余的水量，分别为 700 和 1300 mL。", "print(total, remaining)"],
];
const source = lines.map(([text]) => text).join("\n");

export function loadPortfolioSample() {
  return { source, explanations: lines.map(([, explanation]) => explanation) };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

let serviceCheck;

function hasLocalService(endpoint) {
  if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) return false;
  serviceCheck ??= fetch(endpoint, { method: "HEAD", cache: "no-store" })
    .then(response => response.headers.get("X-Portfolio-Line-Reader") === "local")
    .catch(() => false);
  return serviceCheck;
}

export async function portfolioRequest(action, request) {
  const { apiKey, sample, lines: requestedLines, mode, targetLanguage } = JSON.parse(request.body);
  if (apiKey) {
    const endpoint = new URL(`./api/${action}`, import.meta.url);
    if (!await hasLocalService(endpoint)) {
      return json({ error: "真实处理需要由本地 Node 预览启动。示例可以离线操作。" }, 400);
    }
    return fetch(endpoint, request);
  }
  if (!sample) return json({ error: "自选文件可在本地查看；生成解释需填写 API key，或载入内置示例。" }, 400);
  if (mode === "translate" && !["简体中文", "中文", "Chinese"].includes(targetLanguage)) {
    return json({ error: "离线示例提供简体中文译文，其他目标语言需要连接 DeepSeek。" }, 400);
  }

  await new Promise((resolve, reject) => {
    const signal = request.signal;
    const pending = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, action === "context" ? 320 : 250);
    function abort() { clearTimeout(pending); reject(signal.reason); }
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
  if (action === "context") return json({ contextPrompt: "Python 示例：列表记录每次饮水量（mL），依次计算已喝总量、每日目标和剩余水量。变量名与数字保持原样。" });
  const items = requestedLines.map(({ number }) => ({ line: number, result: lines[number - 1][mode === "translate" ? 2 : 1] }));
  return json({ items });
}
