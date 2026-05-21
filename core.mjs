const FIELD_ALIASES = {
  title: ["商品标题", "标题", "商品名称", "名称", "title", "product title", "name"],
  sku: ["sku", "SKU", "商家编码", "货号", "商品编码", "规格编码", "variant sku"],
  handle: ["handle", "Handle", "商品ID", "商品id", "SPU", "spu", "产品ID", "产品id"],
  image: ["图片", "主图", "图片链接", "图片URL", "图片地址", "主图链接", "image", "image src", "image url"],
  imageAlt: ["图片ALT", "图片alt", "图片描述", "image alt text", "alt"],
  price: ["价格", "售价", "销售价", "商品价格", "price", "variant price"],
  compareAtPrice: ["原价", "划线价", "compare at price", "variant compare at price"],
  stock: ["库存", "库存数量", "inventory", "variant inventory qty", "qty"],
  inventoryTracker: ["inventory tracker", "variant inventory tracker"],
  option1Name: ["option1 name", "option 1 name", "规格1名称"],
  option1Value: ["option1 value", "option 1 value", "规格1值"],
  option2Name: ["option2 name", "option 2 name", "规格2名称"],
  option2Value: ["option2 value", "option 2 value", "规格2值"],
  option3Name: ["option3 name", "option 3 name", "规格3名称"],
  option3Value: ["option3 value", "option 3 value", "规格3值"],
  description: ["描述", "商品描述", "详情", "详情描述", "body", "body (html)", "description"],
  seoTitle: ["SEO标题", "seo标题", "搜索标题", "page title", "seo title"],
  seoDescription: ["SEO描述", "seo描述", "meta description", "seo description"],
  material: ["材质", "材料", "material"],
  size: ["尺寸", "规格", "size", "dimensions"],
};

const RISK_TERMS = [
  "最好",
  "最佳",
  "第一",
  "顶级",
  "国家级",
  "全网最低",
  "最低价",
  "永久",
  "100%",
  "百分百",
  "包治",
  "治疗",
  "疗效",
  "医疗级",
  "食品级",
  "FDA",
  "CE认证",
  "无毒",
  "防水",
  "防火",
  "抗菌",
  "杀菌",
];

const FIELD_LABELS = {
  title: "商品标题",
  sku: "SKU/货号",
  handle: "商品 Handle/SPU",
  image: "图片",
  imageAlt: "图片 ALT",
  price: "价格",
  compareAtPrice: "对比价",
  stock: "库存",
  inventoryTracker: "库存追踪",
  option1Name: "规格 1 名称",
  option1Value: "规格 1 值",
  option2Name: "规格 2 名称",
  option2Value: "规格 2 值",
  option3Name: "规格 3 名称",
  option3Value: "规格 3 值",
  description: "商品描述",
  seoTitle: "SEO 标题",
  seoDescription: "SEO 描述",
  material: "材质",
  size: "尺寸/规格",
};

export function parseCsv(text) {
  return parseDelimited(text, ",");
}

export function parseTable(text) {
  const source = stripBom(String(text || ""));
  return parseDelimited(source, detectDelimiter(source));
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const source = stripBom(String(text || ""));

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((header, index) => header.trim() || `未命名列${index + 1}`);
  const records = rows.slice(1).map((cells, index) => {
    const record = { __rowNumber: index + 2 };
    headers.forEach((header, cellIndex) => {
      record[header] = cells[cellIndex] ?? "";
    });
    return record;
  });

  return { headers, records };
}

function detectDelimiter(source) {
  const firstDataLine = String(source || "")
    .split(/\r?\n/)
    .find((line) => line.trim() !== "") || "";
  const commaCount = countDelimiterOutsideQuotes(firstDataLine, ",");
  const tabCount = countDelimiterOutsideQuotes(firstDataLine, "\t");
  return tabCount > commaCount ? "\t" : ",";
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) count += 1;
  }

  return count;
}

export function analyzeProducts(headers, records) {
  const fieldMap = detectFields(headers);
  const issues = [];
  const seenSkus = new Map();
  const seenHandles = new Map();
  const handleRows = new Map();
  const shopifyMode = isShopifyLike(headers, fieldMap);

  records.forEach((record) => {
    const rowNumber = record.__rowNumber;
    const title = getField(record, fieldMap.title);
    const sku = normalizeSpaces(getField(record, fieldMap.sku));
    const handle = normalizeSpaces(getField(record, fieldMap.handle));
    const image = getField(record, fieldMap.image);
    const imageAlt = getField(record, fieldMap.imageAlt);
    const price = getField(record, fieldMap.price);
    const compareAtPrice = getField(record, fieldMap.compareAtPrice);
    const stock = getField(record, fieldMap.stock);
    const inventoryTracker = getField(record, fieldMap.inventoryTracker);
    const option1Name = getField(record, fieldMap.option1Name);
    const option1Value = getField(record, fieldMap.option1Value);
    const option2Name = getField(record, fieldMap.option2Name);
    const option2Value = getField(record, fieldMap.option2Value);
    const option3Name = getField(record, fieldMap.option3Name);
    const option3Value = getField(record, fieldMap.option3Value);
    const description = getField(record, fieldMap.description);
    const seoTitle = getField(record, fieldMap.seoTitle);
    const seoDescription = getField(record, fieldMap.seoDescription);
    const material = getField(record, fieldMap.material);
    const size = getField(record, fieldMap.size);

    if (!title.trim()) {
      addIssue(issues, "critical", rowNumber, fieldMap.title, "商品标题为空", title, "补充清晰标题，至少包含核心品类和关键属性。");
    } else {
      if (lengthScore(title) > 60) {
        addIssue(issues, "warning", rowNumber, fieldMap.title, "商品标题偏长", title, "建议压缩到 60 个中文字符以内，避免移动端展示截断。");
      }
      addRiskTermIssues(issues, rowNumber, fieldMap.title, title);
    }

    if (!sku) {
      addIssue(issues, "critical", rowNumber, fieldMap.sku, "SKU/货号为空", sku, "补充唯一 SKU，避免导入后无法区分规格或库存。");
    } else if (seenSkus.has(sku)) {
      addIssue(issues, "critical", rowNumber, fieldMap.sku, "SKU/货号重复", sku, `与第 ${seenSkus.get(sku)} 行重复，请保留唯一编码。`);
    } else {
      seenSkus.set(sku, rowNumber);
    }

    if (handle) {
      if (!handleRows.has(handle)) handleRows.set(handle, []);
      handleRows.get(handle).push(rowNumber);

      if (seenHandles.has(handle)) {
        const severity = shopifyMode ? "info" : "warning";
        addIssue(issues, severity, rowNumber, fieldMap.handle, "商品 Handle/SPU 重复", handle, `与第 ${seenHandles.get(handle)} 行重复；若是同一商品多规格可以保留，否则需拆分。`);
      } else {
        seenHandles.set(handle, rowNumber);
      }
    }

    if (!image.trim()) {
      addIssue(issues, "critical", rowNumber, fieldMap.image, "图片为空", image, "补充主图链接或图片文件名，避免导入后商品无图。");
    } else if (!looksLikeImageValue(image)) {
      addIssue(issues, "warning", rowNumber, fieldMap.image, "图片字段不像有效图片地址", image, "确认是否为图片 URL、文件名或平台允许的图片字段。");
    }

    if (image.trim() && hasMultipleImageUrls(image)) {
      addIssue(issues, "warning", rowNumber, fieldMap.image, "图片字段包含多个链接", image.slice(0, 160), "Shopify 多图通常需要拆成多行或按平台模板填写图片列，不要把多个 URL 挤在一个单元格。");
    }

    if (image.trim() && !imageAlt.trim()) {
      addIssue(issues, "info", rowNumber, fieldMap.imageAlt, "图片 ALT 为空", imageAlt, "可补充简短图片描述，利于搜索和无障碍展示。");
    }

    if (!price.trim()) {
      addIssue(issues, "critical", rowNumber, fieldMap.price, "价格为空", price, "补充售价，并确认币种和税费规则。");
    } else {
      const parsedPrice = parsePrice(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        addIssue(issues, "critical", rowNumber, fieldMap.price, "价格异常", price, "价格应为大于 0 的数字，避免导入失败或亏本销售。");
      } else if (parsedPrice < 1) {
        addIssue(issues, "warning", rowNumber, fieldMap.price, "价格过低", price, "确认是否漏填单位、币种或小数点。");
      }

      if (compareAtPrice.trim()) {
        const parsedCompareAtPrice = parsePrice(compareAtPrice);
        if (!Number.isFinite(parsedCompareAtPrice) || parsedCompareAtPrice <= 0) {
          addIssue(issues, "warning", rowNumber, fieldMap.compareAtPrice, "对比价异常", compareAtPrice, "对比价应为大于 0 的数字；不使用划线价时可以留空。");
        } else if (Number.isFinite(parsedPrice) && parsedCompareAtPrice <= parsedPrice) {
          addIssue(issues, "warning", rowNumber, fieldMap.compareAtPrice, "对比价不高于售价", compareAtPrice, "Shopify 的 Compare At Price 通常应高于 Variant Price，否则折扣展示可能异常。");
        }
      }
    }

    if (!stock.trim()) {
      addIssue(issues, "info", rowNumber, fieldMap.stock, "库存为空", stock, "若平台要求库存字段，需补充可售数量或设置为平台允许的默认值。");
    } else if (!isIntegerLike(stock)) {
      addIssue(issues, "warning", rowNumber, fieldMap.stock, "库存不是整数", stock, "库存通常应为非负整数，请确认是否混入文字。");
    } else if (shopifyMode && isVariantInventoryQty(fieldMap.stock) && (!fieldMap.inventoryTracker || !inventoryTracker.trim())) {
      addIssue(issues, "info", rowNumber, fieldMap.inventoryTracker, "库存数量有值但库存追踪为空", inventoryTracker, "如果需要 Shopify 跟踪库存，确认 Variant Inventory Tracker 是否应填写 shopify。");
    }

    addOptionPairIssue(issues, rowNumber, fieldMap.option1Name, fieldMap.option1Value, option1Name, option1Value, "Option1");
    addOptionPairIssue(issues, rowNumber, fieldMap.option2Name, fieldMap.option2Value, option2Name, option2Value, "Option2");
    addOptionPairIssue(issues, rowNumber, fieldMap.option3Name, fieldMap.option3Value, option3Name, option3Value, "Option3");

    if (!description.trim()) {
      addIssue(issues, "warning", rowNumber, fieldMap.description, "商品描述为空", description, "补充材质、尺寸、适用场景、包装和注意事项。");
    } else {
      addRiskTermIssues(issues, rowNumber, fieldMap.description, description);
      if (hasSuspiciousHtml(description)) {
        addIssue(issues, "warning", rowNumber, fieldMap.description, "描述里可能有异常 HTML", description.slice(0, 120), "检查是否有未闭合标签、脚本或从外部复制的冗余代码。");
      }
    }

    if (fieldMap.seoTitle && !seoTitle.trim()) {
      addIssue(issues, "info", rowNumber, fieldMap.seoTitle, "SEO 标题为空", seoTitle, "可复用精简商品标题，避免堆砌关键词。");
    } else if (seoTitle.trim() && lengthScore(seoTitle) > 70) {
      addIssue(issues, "warning", rowNumber, fieldMap.seoTitle, "SEO 标题偏长", seoTitle, "建议控制在约 70 个英文字符或 35 个中文字符以内。");
    }

    if (fieldMap.seoDescription && !seoDescription.trim()) {
      addIssue(issues, "info", rowNumber, fieldMap.seoDescription, "SEO 描述为空", seoDescription, "补充一句自然描述，包含品类、核心卖点和适用场景。");
    } else if (seoDescription.trim() && lengthScore(seoDescription) > 160) {
      addIssue(issues, "warning", rowNumber, fieldMap.seoDescription, "SEO 描述偏长", seoDescription, "建议控制在 160 个英文字符左右。");
    }

    if (!material.trim()) {
      addIssue(issues, "info", rowNumber, fieldMap.material, "材质为空", material, "如果客户关心安全、手感或耐用性，建议补充真实材质。");
    }

    if (!size.trim()) {
      addIssue(issues, "info", rowNumber, fieldMap.size, "尺寸/规格为空", size, "补充尺寸、容量或规格，减少售前反复询问。");
    }
  });

  addNonContiguousHandleIssues(issues, handleRows, fieldMap.handle, shopifyMode);

  const summary = summarizeIssues(records.length, issues, fieldMap);
  return { summary, fieldMap, issues };
}

export function issuesToCsv(issues) {
  const headers = ["严重程度", "行号", "字段", "问题", "当前值", "建议"];
  const rows = issues.map((issue) => [
    severityLabel(issue.severity),
    issue.rowNumber,
    issue.fieldLabel,
    issue.message,
    issue.value,
    issue.suggestion,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function fieldLabel(key) {
  return FIELD_LABELS[key] || key || "未识别字段";
}

export function severityLabel(severity) {
  return {
    critical: "严重",
    warning: "提醒",
    info: "建议",
  }[severity] || severity;
}

function detectFields(headers) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([key, aliases]) => {
      const match = normalizedHeaders.find((header) =>
        aliases.some((alias) => header.normalized === normalizeHeader(alias))
      );
      return [key, match?.original || ""];
    })
  );
}

function getField(record, header) {
  if (!header) return "";
  return String(record[header] ?? "");
}

function addIssue(issues, severity, rowNumber, field, message, value, suggestion) {
  issues.push({
    severity,
    rowNumber,
    field,
    fieldLabel: labelForDetectedField(field),
    message,
    value: String(value ?? "").trim(),
    suggestion,
  });
}

function addRiskTermIssues(issues, rowNumber, field, text) {
  const normalizedText = String(text || "").toLowerCase();
  const matched = RISK_TERMS.filter((term) => normalizedText.includes(term.toLowerCase()));
  if (matched.length === 0) return;

  addIssue(
    issues,
    "warning",
    rowNumber,
    field,
    `疑似风险表达：${matched.join("、")}`,
    String(text).slice(0, 160),
    "这些词不一定违规，但建议人工确认资质、证据和平台规则，避免绝对化或功效承诺。"
  );
}

function addOptionPairIssue(issues, rowNumber, nameField, valueField, name, value, label) {
  const hasName = String(name || "").trim();
  const hasValue = String(value || "").trim();

  if (hasName && !hasValue) {
    addIssue(issues, "warning", rowNumber, valueField, `${label} 有名称但缺少值`, value, "有规格名称时应补充对应规格值，避免 Shopify 变体结构异常。");
  }

  if (!hasName && hasValue) {
    addIssue(issues, "warning", rowNumber, nameField, `${label} 有值但缺少名称`, value, "有规格值时应补充对应规格名称，例如 Color、Size。");
  }
}

function addNonContiguousHandleIssues(issues, handleRows, handleField, shopifyMode) {
  if (!shopifyMode || !handleField) return;

  handleRows.forEach((rows, handle) => {
    if (rows.length < 2) return;
    const sorted = [...rows].sort((a, b) => a - b);
    const contiguous = sorted.every((row, index) => index === 0 || row === sorted[index - 1] + 1);
    if (contiguous) return;

    addIssue(
      issues,
      "warning",
      sorted[0],
      handleField,
      "同一 Handle 的变体行不连续",
      handle,
      `同一 Shopify 商品的变体行建议放在一起；当前出现在第 ${sorted.join("、")} 行。`
    );
  });
}

function summarizeIssues(totalRows, issues, fieldMap) {
  const counts = issues.reduce(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );

  const detectedFields = Object.entries(fieldMap)
    .filter(([, header]) => Boolean(header))
    .map(([key, header]) => ({ key, label: fieldLabel(key), header }));

  const score = Math.max(0, 100 - counts.critical * 12 - counts.warning * 5 - counts.info * 1);

  return {
    totalRows,
    totalIssues: issues.length,
    score,
    counts,
    detectedFields,
  };
}

function isShopifyLike(headers, fieldMap) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return Boolean(
    normalizedHeaders.includes("variant sku") ||
    normalizedHeaders.includes("variant price") ||
    normalizedHeaders.includes("image src") ||
    fieldMap.option1Name ||
    fieldMap.option1Value ||
    fieldMap.compareAtPrice ||
    fieldMap.inventoryTracker
  );
}

function labelForDetectedField(header) {
  const match = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalizeHeader(alias) === normalizeHeader(header))
  );
  return match ? fieldLabel(match[0]) : header || "未识别字段";
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSpaces(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function lengthScore(value) {
  return [...String(value || "")].reduce((total, char) => {
    return total + (char.charCodeAt(0) > 127 ? 2 : 1);
  }, 0);
}

function parsePrice(value) {
  const cleaned = String(value || "").replace(/[¥￥$,，\s]/g, "");
  return Number.parseFloat(cleaned);
}

function isIntegerLike(value) {
  const text = String(value || "").trim();
  if (!/^-?\d+$/.test(text)) return false;
  return Number.parseInt(text, 10) >= 0;
}

function looksLikeImageValue(value) {
  const text = String(value || "").trim();
  return /^(https?:)?\/\//i.test(text) || /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(text);
}

function hasMultipleImageUrls(value) {
  const matches = String(value || "").match(/https?:\/\/[^\s,;|]+/gi);
  return (matches || []).length > 1;
}

function isVariantInventoryQty(header) {
  return normalizeHeader(header) === "variant inventory qty";
}

function hasSuspiciousHtml(value) {
  const text = String(value || "");
  return /<script|javascript:|<\/?(html|body|iframe)\b/i.test(text);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
