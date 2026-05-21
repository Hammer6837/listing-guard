import { analyzeProducts, issuesToCsv, parseTable, severityLabel } from "./core.mjs?v=shopify-checks";

const fileInput = document.querySelector("#csvFile");
const pasteInput = document.querySelector("#pasteData");
const analyzePasteButton = document.querySelector("#analyzePaste");
const sampleButton = document.querySelector("#loadSample");
const downloadButton = document.querySelector("#downloadReport");
const copyRequestButton = document.querySelector("#copyRequest");
const resetButton = document.querySelector("#resetTool");
const statusText = document.querySelector("#statusText");
const summaryEl = document.querySelector("#summary");
const fieldsEl = document.querySelector("#fields");
const issuesEl = document.querySelector("#issues");
const requestBox = document.querySelector("#requestBox");
const requestText = document.querySelector("#requestText");
const emptyState = document.querySelector("#emptyState");
const fileNameEl = document.querySelector("#fileName");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let currentIssues = [];
let currentFilter = "all";
let currentSummary = null;

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  runAnalysis(text, file.name);
});

analyzePasteButton.addEventListener("click", () => {
  const text = pasteInput.value.trim();
  if (!text) {
    statusText.textContent = "请先粘贴从 Excel、表格或 CSV 复制的内容。";
    return;
  }
  runAnalysis(text, "粘贴表格内容");
});

sampleButton.addEventListener("click", async () => {
  const response = await fetch("./sample-products.csv");
  const text = await response.text();
  runAnalysis(text, "sample-products.csv");
});

downloadButton.addEventListener("click", () => {
  if (currentIssues.length === 0) return;
  const csv = "\ufeff" + issuesToCsv(currentIssues);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `商品上架体检报告-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

copyRequestButton.addEventListener("click", async () => {
  if (!currentSummary) return;
  const text = buildDiagnosisRequest();
  requestText.value = text;
  requestBox.hidden = false;
  requestText.focus();
  requestText.select();
  const copied = await copyText(text);
  statusText.textContent = copied
    ? "已复制诊断需求说明，可粘贴给服务方并附上脱敏表。"
    : "已生成诊断需求说明；若浏览器禁止自动复制，请手动复制文本框内容。";
});

resetButton.addEventListener("click", () => {
  fileInput.value = "";
  pasteInput.value = "";
  currentIssues = [];
  currentFilter = "all";
  currentSummary = null;
  fileNameEl.textContent = "未选择文件";
  statusText.textContent = "上传 CSV 或粘贴表格后开始体检。";
  summaryEl.innerHTML = "";
  fieldsEl.innerHTML = "";
  issuesEl.innerHTML = "";
  requestText.value = "";
  requestBox.hidden = true;
  emptyState.hidden = false;
  downloadButton.disabled = true;
  copyRequestButton.disabled = true;
  setActiveFilter("all");
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    setActiveFilter(currentFilter);
    renderIssues();
  });
});

function runAnalysis(text, filename) {
  try {
    const { headers, records } = parseTable(text);
    if (headers.length === 0 || records.length === 0) {
      throw new Error("表格没有可分析的数据行。");
    }

    const result = analyzeProducts(headers, records);
    currentIssues = result.issues;
    currentSummary = result.summary;
    requestText.value = buildDiagnosisRequest();
    requestBox.hidden = false;
    fileNameEl.textContent = filename;
    statusText.textContent = `已完成 ${result.summary.totalRows} 行商品资料体检。`;
    emptyState.hidden = true;
    downloadButton.disabled = currentIssues.length === 0;
    copyRequestButton.disabled = false;
    renderSummary(result.summary);
    renderFields(result.summary.detectedFields);
    renderIssues();
  } catch (error) {
    statusText.textContent = error.message || "解析失败，请确认内容是 CSV 或从表格复制的文本。";
    emptyState.hidden = false;
    downloadButton.disabled = true;
    copyRequestButton.disabled = true;
  }
}

function buildDiagnosisRequest() {
  const counts = currentSummary.counts;
  const detectedFields = currentSummary.detectedFields
    .map((field) => `${field.label}=${field.header}`)
    .join("，") || "未识别到常见字段";

  return [
    "我需要一份商品表人工诊断。",
    "",
    `商品行数：${currentSummary.totalRows}`,
    `当前报告：严重问题 ${counts.critical} 个，提醒 ${counts.warning} 个，建议 ${counts.info} 个。`,
    `已识别字段：${detectedFields}`,
    "",
    "我会提供脱敏后的 CSV/Excel 商品表。",
    "已删除：成本价、供应商、客户信息、订单号、物流单号、内部备注、账号密码。",
    "",
    "请先判断是否适合做 99 元人工诊断；服务边界是不承诺导入成功、审核通过、排名或销量。"
  ].join("\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea copy for older or restricted browsers.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function renderSummary(summary) {
  summaryEl.innerHTML = `
    <div class="metric score">
      <span class="metric-label">体检分</span>
      <strong>${summary.score}</strong>
    </div>
    <div class="metric">
      <span class="metric-label">商品行数</span>
      <strong>${summary.totalRows}</strong>
    </div>
    <div class="metric critical">
      <span class="metric-label">严重问题</span>
      <strong>${summary.counts.critical}</strong>
    </div>
    <div class="metric warning">
      <span class="metric-label">提醒</span>
      <strong>${summary.counts.warning}</strong>
    </div>
    <div class="metric info">
      <span class="metric-label">建议</span>
      <strong>${summary.counts.info}</strong>
    </div>
  `;
}

function renderFields(fields) {
  if (fields.length === 0) {
    fieldsEl.innerHTML = "<p class=\"muted\">没有识别到常见商品字段，请检查表头。</p>";
    return;
  }

  fieldsEl.innerHTML = fields
    .map((field) => `<span class="field-chip">${field.label}<small>${field.header}</small></span>`)
    .join("");
}

function renderIssues() {
  const filtered = currentFilter === "all"
    ? currentIssues
    : currentIssues.filter((issue) => issue.severity === currentFilter);

  if (filtered.length === 0) {
    issuesEl.innerHTML = `<div class="empty-result">当前筛选下没有问题。</div>`;
    return;
  }

  issuesEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>级别</th>
          <th>行号</th>
          <th>字段</th>
          <th>问题</th>
          <th>建议</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(renderIssueRow).join("")}
      </tbody>
    </table>
  `;
}

function renderIssueRow(issue) {
  return `
    <tr>
      <td><span class="badge ${issue.severity}">${severityLabel(issue.severity)}</span></td>
      <td>${issue.rowNumber}</td>
      <td>${escapeHtml(issue.fieldLabel)}</td>
      <td>
        <strong>${escapeHtml(issue.message)}</strong>
        ${issue.value ? `<span class="value">${escapeHtml(issue.value)}</span>` : ""}
      </td>
      <td>${escapeHtml(issue.suggestion)}</td>
    </tr>
  `;
}

function setActiveFilter(filter) {
  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
