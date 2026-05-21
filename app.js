import { analyzeProducts, issuesToCsv, parseTable, severityLabel } from "./core.mjs";

const fileInput = document.querySelector("#csvFile");
const pasteInput = document.querySelector("#pasteData");
const analyzePasteButton = document.querySelector("#analyzePaste");
const sampleButton = document.querySelector("#loadSample");
const downloadButton = document.querySelector("#downloadReport");
const resetButton = document.querySelector("#resetTool");
const statusText = document.querySelector("#statusText");
const summaryEl = document.querySelector("#summary");
const fieldsEl = document.querySelector("#fields");
const issuesEl = document.querySelector("#issues");
const emptyState = document.querySelector("#emptyState");
const fileNameEl = document.querySelector("#fileName");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

let currentIssues = [];
let currentFilter = "all";

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

resetButton.addEventListener("click", () => {
  fileInput.value = "";
  pasteInput.value = "";
  currentIssues = [];
  currentFilter = "all";
  fileNameEl.textContent = "未选择文件";
  statusText.textContent = "上传 CSV 或粘贴表格后开始体检。";
  summaryEl.innerHTML = "";
  fieldsEl.innerHTML = "";
  issuesEl.innerHTML = "";
  emptyState.hidden = false;
  downloadButton.disabled = true;
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
    fileNameEl.textContent = filename;
    statusText.textContent = `已完成 ${result.summary.totalRows} 行商品资料体检。`;
    emptyState.hidden = true;
    downloadButton.disabled = currentIssues.length === 0;
    renderSummary(result.summary);
    renderFields(result.summary.detectedFields);
    renderIssues();
  } catch (error) {
    statusText.textContent = error.message || "解析失败，请确认内容是 CSV 或从表格复制的文本。";
    emptyState.hidden = false;
    downloadButton.disabled = true;
  }
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
