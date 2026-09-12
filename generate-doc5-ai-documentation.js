const { Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, PageNumber, PageBreak, BorderStyle, ShadingType, WidthType,
  TableOfContents, NumberFormat, SectionType, TableLayoutType } = require("docx");
const fs = require("fs");

// ── Palette: DM-1 Deep Cyan (AI/Tech) ──
const P = {
  primary: "162235", body: "1A2B40", secondary: "6878A0",
  accent: "37DCF2", surface: "F4F8FC",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  bg: "162235",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Title layout helpers ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...'，。、；：！？', ...'的与和及之在于为', ...'-_—–·/', ...' \t']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: 0, bottomSpacing };
}

// ── Cover R1 ──
function buildCoverR1() {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout("NEXUS HRMS AI Documentation", availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: true, hasEnglishLabel: true,
    metaLineCount: 2, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({ text: "N E X U S   H R M S", size: 18, color: P.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
  }));
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({
    indent: { left: padL }, spacing: { after: 800 },
    children: [new TextRun({ text: "SaaS-Based AI-Powered Human Resource Management System", size: 24, color: P.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
  }));
  for (const line of ["Module-wise AI Features & Documentation", "Comprehensive Technical Reference"]) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: "Version 1.0  |  June 2026", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: "NEXUS HRMS Development Team", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── Reusable paragraph builders ──
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32 })],
  });
}
function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28 })],
  });
}
function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 26 })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}
function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}
function codeLine(text) {
  return new Paragraph({
    spacing: { before: 20, after: 20, line: 276 },
    shading: { type: ShadingType.CLEAR, fill: "F0F4F8" },
    indent: { left: 360 },
    children: [new TextRun({ text, size: 20, color: "2D3748", font: { ascii: "Courier New" } })],
  });
}
function bulletItem(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    indent: { left: 720, hanging: 360 },
    children: [new TextRun({ text: "\u2022 " + text, size: 24, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}

// ── Table builder with zebra striping ──
function makeTable(headers, rows) {
  const t = P.table;
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, size: 21, color: t.headerText, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] })],
    shading: { type: ShadingType.CLEAR, fill: t.headerBg },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  }));
  const dataRows = rows.map((row, idx) => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 21, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] })],
      shading: idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: t.surface } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: t.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
  });
}

// ── Page number footer ──
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary, font: { ascii: "Times New Roman" } })],
    })],
  });
}

// ══════════════════════════════════════════
// DOCUMENT CONTENT
// ══════════════════════════════════════════
const bodyContent = [];

// ══════════════════════════════════════════
// Chapter 1: AI Architecture Overview
// ══════════════════════════════════════════
bodyContent.push(heading1("1. AI Architecture Overview"));

bodyContent.push(body("The AI architecture of NEXUS HRMS is built upon the z-ai-web-dev-sdk, a comprehensive AI development toolkit that provides unified access to large language model capabilities across the entire platform. This SDK abstracts the complexity of direct API interactions, offering a streamlined interface for chat completions, streaming responses, and structured output generation. The architecture follows a layered design pattern where the SDK layer handles model communication, the service layer manages business logic and prompt orchestration, and the application layer integrates AI capabilities into individual HR modules such as interviews, assistance, recruitment, and engagement analytics."));

bodyContent.push(body("At the core of the architecture lies the AI model configuration system, which allows administrators to select and tune language models for different use cases. Each module can reference a distinct model configuration with independent temperature, max_tokens, and top_p settings, enabling fine-grained control over AI behavior. For instance, the AI Interview module uses a lower temperature (0.3-0.5) for consistent and objective scoring, while the AI Assistant employs a higher temperature (0.6-0.8) for more conversational and creative responses. All configurations are persisted in the database and can be modified at runtime through the AI Admin Console without requiring application restarts."));

bodyContent.push(body("Prompt engineering within the system follows a template-based approach where system prompts, user context injection, and response format instructions are managed as versioned templates. Each template defines the persona, behavioral constraints, output schema, and few-shot examples that govern AI behavior for a specific feature. The response parsing layer implements a robust validation pipeline that extracts structured data from AI outputs, validates against expected schemas, and gracefully handles malformed responses through retry logic and fallback strategies. Error handling encompasses rate limiting with exponential backoff, quota management with tenant-level usage tracking, circuit breaker patterns for service degradation, and comprehensive logging through the AIChatLog model."));

bodyContent.push(heading2("1.1 SDK Integration and Configuration"));
bodyContent.push(body("The z-ai-web-dev-sdk is initialized at application startup with tenant-specific credentials and configuration. The SDK provides a singleton client instance that manages connection pooling, request queuing, and automatic retry logic. Each API call is instrumented with timing metrics, token counting, and error tracking that feed into the AI Admin Console's analytics dashboard. The SDK supports both synchronous and streaming response modes, with streaming preferred for interactive use cases such as the AI Assistant chat interface to provide real-time token-by-token response rendering."));

bodyContent.push(codeLine("// SDK initialization pattern"));
bodyContent.push(codeLine("import { ZAI } from 'z-ai-web-dev-sdk';"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("const aiClient = new ZAI({"));
bodyContent.push(codeLine("  apiKey: process.env.ZAI_API_KEY,"));
bodyContent.push(codeLine("  model: 'gpt-4',"));
bodyContent.push(codeLine("  temperature: 0.5,"));
bodyContent.push(codeLine("  maxTokens: 2048,"));
bodyContent.push(codeLine("  topP: 0.9,"));
bodyContent.push(codeLine("}));"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("// Chat completion with structured output"));
bodyContent.push(codeLine("const response = await aiClient.chat.completions.create({"));
bodyContent.push(codeLine("  messages: ["));
bodyContent.push(codeLine("    { role: 'system', content: systemPrompt },"));
bodyContent.push(codeLine("    { role: 'user', content: userQuery }"));
bodyContent.push(codeLine("  ],"));
bodyContent.push(codeLine("  response_format: { type: 'json_object' }"));
bodyContent.push(codeLine("});"));

bodyContent.push(heading2("1.2 AI Model Configuration Parameters"));
bodyContent.push(makeTable(
  ["Parameter", "Type", "Default", "Description"],
  [
    ["model", "string", "gpt-4", "Language model identifier for the AI provider"],
    ["temperature", "float", "0.5", "Controls randomness in generation (0.0-2.0); lower = deterministic"],
    ["max_tokens", "integer", "2048", "Maximum tokens in the AI response"],
    ["top_p", "float", "0.9", "Nucleus sampling threshold; limits token selection to top probability mass"],
    ["frequency_penalty", "float", "0.0", "Penalizes repeated tokens (-2.0 to 2.0)"],
    ["presence_penalty", "float", "0.0", "Encourages topic diversity (-2.0 to 2.0)"],
    ["response_format", "object", "null", "Enforces structured output (json_object, json_schema)"],
    ["stream", "boolean", "false", "Enable server-sent events for real-time token streaming"],
    ["stop", "string[]", "null", "Custom stop sequences to terminate generation"],
    ["timeout", "integer", "30000", "Request timeout in milliseconds"],
  ]
));

bodyContent.push(heading2("1.3 Prompt Engineering Patterns"));
bodyContent.push(body("The platform implements four primary prompt engineering patterns that are applied across all AI modules. The Persona Pattern assigns a specific role and expertise level to the AI, such as a senior technical interviewer or an HR compliance advisor. The Context Injection Pattern dynamically prepends relevant business context including company policies, job requirements, employee records, and historical interaction data into the prompt. The Schema Enforcement Pattern instructs the AI to respond in a specific JSON schema, enabling automated parsing and validation of structured outputs. Finally, the Chain-of-Thought Pattern guides the AI through multi-step reasoning processes, particularly for complex evaluation tasks like interview scoring and performance analysis."));

bodyContent.push(codeLine("// Prompt template structure"));
bodyContent.push(codeLine("interface PromptTemplate {"));
bodyContent.push(codeLine("  id: string;"));
bodyContent.push(codeLine("  name: string;"));
bodyContent.push(codeLine("  module: 'interview' | 'assistant' | 'recruitment' | 'performance' | 'engagement';"));
bodyContent.push(codeLine("  systemPrompt: string;"));
bodyContent.push(codeLine("  contextTemplate: string;  // Mustache-style {{variables}}"));
bodyContent.push(codeLine("  responseSchema: object;   // JSON Schema for validation"));
bodyContent.push(codeLine("  examples: FewShotExample[];"));
bodyContent.push(codeLine("  version: number;"));
bodyContent.push(codeLine("  isActive: boolean;"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("1.4 Performance Considerations"));
bodyContent.push(body("AI service performance is monitored through multiple dimensions: latency (p50, p95, p99), throughput (requests per minute), token consumption rate, error rate, and cost per interaction. The architecture implements several optimization strategies including prompt caching for frequently used system prompts, response caching for identical queries within a session window, batch processing for non-interactive AI tasks like resume screening, and adaptive token limits that adjust max_tokens based on response complexity indicators. Rate limiting is enforced at both the tenant level and the feature level to prevent any single module from monopolizing the AI service quota."));

bodyContent.push(heading2("1.5 Limitations and Mitigations"));
bodyContent.push(makeTable(
  ["Limitation", "Impact", "Mitigation Strategy"],
  [
    ["Token limit per request", "Long conversations may be truncated", "Implement conversation summarization and context windowing"],
    ["Model latency variability", "Inconsistent user experience", "Streaming responses + optimistic UI rendering"],
    ["Hallucination risk", "Incorrect AI-generated content", "Schema enforcement + confidence scoring + human review"],
    ["Rate limit constraints", "Feature throttling during peak usage", "Priority queuing + tenant quota management"],
    ["Cost scaling", "Budget overruns with high usage", "Token budgeting per feature + cost alerting thresholds"],
    ["Multilingual accuracy", "Reduced quality for non-English inputs", "Language-specific prompt templates + translation validation"],
  ]
));

bodyContent.push(heading2("1.6 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Multi-model routing: Automatically select the optimal model based on query complexity and cost constraints"));
bodyContent.push(bulletItem("Fine-tuned models: Train domain-specific models on HR data for improved accuracy in scoring and analysis"));
bodyContent.push(bulletItem("RAG pipeline: Implement retrieval-augmented generation for real-time knowledge base integration"));
bodyContent.push(bulletItem("AI agent framework: Enable autonomous multi-step AI workflows with tool-calling capabilities"));
bodyContent.push(bulletItem("On-premise model deployment: Support for self-hosted models to address data sovereignty requirements"));

// ══════════════════════════════════════════
// Chapter 2: AI Admin Console Module
// ══════════════════════════════════════════
bodyContent.push(heading1("2. AI Admin Console Module"));

bodyContent.push(body("The AI Admin Console is the centralized management interface for all AI features within NEXUS HRMS. Accessible to super_admin and tenant_admin roles, it provides granular control over model configurations, prompt templates, usage analytics, and performance monitoring. The console is implemented at src/app/(dashboard)/ai-admin/page.tsx and serves as the single pane of glass for administrators to understand, configure, and optimize the AI capabilities that permeate the platform's HR modules. Every AI interaction across the system traces back to a configuration managed through this console."));

bodyContent.push(body("The Model Configuration view allows administrators to create and manage named AI configurations, each specifying a model identifier, temperature, max_tokens, top_p, and other generation parameters. These configurations are stored in the database and referenced by individual modules at runtime. When a module initiates an AI call, it resolves its configuration name to the latest active configuration record, ensuring that changes propagate immediately without deployment. The console supports creating multiple configurations per feature, enabling A/B testing of different model parameters to optimize output quality and cost efficiency."));

bodyContent.push(body("The Prompt Template Management section provides full CRUD operations for the prompt templates that govern AI behavior. Each template includes a system prompt, a context injection template with variable placeholders, a JSON schema for response validation, and few-shot examples for in-context learning. Versioning is built into the template system, allowing administrators to roll back to previous versions if a new prompt produces suboptimal results. The template editor supports syntax highlighting for prompt engineering, variable validation, and preview rendering that shows how the final prompt will appear with sample data substituted."));

bodyContent.push(body("The Usage Analytics dashboard aggregates data from the AIChatLog model to present real-time and historical metrics on AI feature consumption. Key visualizations include daily request volume by module, token consumption trends, average response latency per model, error rate breakdowns by feature, and cost attribution per tenant. The dashboard supports time range filtering, module-level drill-down, and export to CSV for external reporting. Cost tracking is particularly important for SaaS operations, as it enables administrators to identify cost anomalies, set budget alerts, and optimize model selection to balance quality and expenditure."));

bodyContent.push(heading2("2.1 Model Selection and Configuration"));
bodyContent.push(makeTable(
  ["Configuration Field", "Data Type", "Validation", "Description"],
  [
    ["configName", "string", "unique, 3-50 chars", "Human-readable identifier for the configuration"],
    ["model", "string", "enum: supported models", "AI model to use (e.g., gpt-4, gpt-3.5-turbo)"],
    ["temperature", "decimal", "0.0-2.0", "Sampling temperature controlling response randomness"],
    ["max_tokens", "integer", "1-4096", "Maximum response length in tokens"],
    ["top_p", "decimal", "0.0-1.0", "Nucleus sampling probability threshold"],
    ["frequency_penalty", "decimal", "-2.0 to 2.0", "Penalty for token frequency in responses"],
    ["presence_penalty", "decimal", "-2.0 to 2.0", "Penalty for token presence in responses"],
    ["module", "string", "enum: module keys", "Target module for this configuration"],
    ["isActive", "boolean", "true/false", "Whether this configuration is currently active"],
    ["tenantId", "string", "UUID reference", "Tenant scope for multi-tenant isolation"],
  ]
));

bodyContent.push(heading2("2.2 Temperature and Token Tuning"));
bodyContent.push(body("Temperature and token tuning is the most impactful configuration for AI output quality. Lower temperature values (0.1-0.3) produce more deterministic, consistent outputs suitable for scoring and evaluation tasks where objectivity is paramount. Medium temperatures (0.4-0.7) balance creativity with coherence for tasks like generating interview questions or writing performance feedback. Higher temperatures (0.8-1.2) encourage diverse and creative outputs useful for brainstorming sessions or generating training recommendations. The max_tokens parameter should be set based on the expected response length: structured JSON outputs typically require 500-1000 tokens, while conversational responses may need 1500-2048 tokens."));

bodyContent.push(codeLine("// Temperature tuning recommendations per module"));
bodyContent.push(codeLine("const moduleDefaults = {"));
bodyContent.push(codeLine("  interview: { temperature: 0.3, max_tokens: 1500, top_p: 0.85 },"));
bodyContent.push(codeLine("  assistant: { temperature: 0.7, max_tokens: 2048, top_p: 0.9 },"));
bodyContent.push(codeLine("  recruitment: { temperature: 0.4, max_tokens: 1000, top_p: 0.85 },"));
bodyContent.push(codeLine("  performance: { temperature: 0.5, max_tokens: 1500, top_p: 0.9 },"));
bodyContent.push(codeLine("  engagement: { temperature: 0.4, max_tokens: 800, top_p: 0.85 },"));
bodyContent.push(codeLine("};"));

bodyContent.push(heading2("2.3 Usage Analytics and Cost Tracking"));
bodyContent.push(body("The analytics engine processes AIChatLog records to generate real-time dashboards and historical trend reports. Each AI interaction is logged with its token consumption (prompt_tokens, completion_tokens, total_tokens), latency in milliseconds, model used, module source, and success/failure status. The cost calculation applies per-model pricing to token counts, providing accurate cost attribution per feature, per tenant, and per time period. Administrators can set cost thresholds that trigger alerts when spending approaches budget limits, preventing unexpected overruns."));

bodyContent.push(makeTable(
  ["Metric", "Aggregation", "Time Granularity", "Alert Threshold"],
  [
    ["Daily request count", "SUM", "Per hour / Per day", "> 10,000 requests/day per tenant"],
    ["Token consumption", "SUM", "Per hour / Per day", "> 2,000,000 tokens/day per tenant"],
    ["Average latency (ms)", "AVG (p50, p95, p99)", "Per hour", "p95 > 5000ms"],
    ["Error rate (%)", "COUNT(errors)/COUNT(*)", "Per hour", "> 5% error rate"],
    ["Cost per feature", "SUM(token_cost)", "Per day", ">$100/day per feature per tenant"],
    ["Cost per tenant", "SUM(all features)", "Per month", "> Monthly budget allocation"],
  ]
));

bodyContent.push(heading2("2.4 Performance Metrics Dashboard"));
bodyContent.push(body("The performance dashboard visualizes AI service health through four key indicators: latency distribution histograms, error rate sparklines, throughput time series, and quality score trends. Latency is tracked at p50, p95, and p99 percentiles to identify tail latency issues that affect user experience. Error rates are categorized by type (timeout, rate limit, invalid response, model error) to guide troubleshooting. Throughput metrics help capacity planning by revealing usage patterns and peak demand periods. Quality scores are derived from user feedback on AI responses and automated evaluation of response schema compliance."));

bodyContent.push(heading2("2.5 Limitations and Mitigations"));
bodyContent.push(bulletItem("Configuration changes apply to new sessions only; active sessions retain their original configuration until completion"));
bodyContent.push(bulletItem("Cost tracking accuracy depends on provider-side token counting; minor discrepancies may occur due to tokenizer differences"));
bodyContent.push(bulletItem("A/B testing of configurations requires manual analysis; automated statistical significance testing is planned for a future release"));
bodyContent.push(bulletItem("Analytics data retention is limited to 90 days by default; longer retention requires dedicated storage configuration"));

bodyContent.push(heading2("2.6 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Auto-tuning: ML-based automatic parameter optimization based on quality feedback signals"));
bodyContent.push(bulletItem("Model benchmarking: Side-by-side comparison of different models on standardized HR evaluation datasets"));
bodyContent.push(bulletItem("Predictive cost forecasting: ML models to predict monthly AI spending based on usage trends"));
bodyContent.push(bulletItem("Federated configuration management: Share and import best-practice configurations across tenants"));

// ══════════════════════════════════════════
// Chapter 3: AI Interview Module
// ══════════════════════════════════════════
bodyContent.push(heading1("3. AI Interview Module"));

bodyContent.push(body("The AI Interview Module is one of the most sophisticated AI-powered features in NEXUS HRMS, providing autonomous interview capabilities that generate contextually relevant questions from job requirements, manage multi-turn conversations, evaluate candidate responses, and produce comprehensive assessment reports. The module is implemented at src/app/(dashboard)/ai-interview/page.tsx with the API endpoint at src/app/api/ai-interview/route.ts. It integrates tightly with the JobPosting and Interview Prisma models, storing AI-generated scores and feedback directly on the Interview record through the aiScore and aiFeedback fields."));

bodyContent.push(body("The interview process follows a structured workflow: when an interviewer or recruiter initiates an AI interview session, the system retrieves the associated JobPosting record to extract job requirements, required skills, experience level, and job description. These inputs are composed into a specialized system prompt that instructs the AI to act as a senior technical interviewer with expertise in the relevant domain. The AI then generates an opening question, evaluates each candidate response for content accuracy, communication clarity, and depth of understanding, and dynamically generates follow-up questions that probe deeper into areas where the candidate's initial response was superficial or incomplete."));

bodyContent.push(body("Response evaluation uses a multi-dimensional scoring framework that produces separate scores for technical knowledge (0-100), communication skills (0-100), problem-solving ability (0-100), and culture fit (0-100). These individual scores are aggregated into an overall aiScore (0-100) using a weighted formula configurable through the AI Admin Console. The default weights are 40% technical, 25% problem-solving, 20% communication, and 15% culture fit. After the interview concludes, the module generates structured feedback including specific strengths, areas for improvement, example quotes from the conversation, and a final recommendation from the set: strong_hire, hire, no_hire, strong_no_hire."));

bodyContent.push(body("All interview interactions are captured in the AIChatLog model with the source field set to 'interview', enabling full audit trails and post-hoc analysis. The sessionId groups all messages within a single interview session, while the metadata JSON field stores evaluation scores, detected topics, and timing information for each exchange. This granular logging supports both compliance requirements and continuous improvement of the interview prompt templates through analysis of scoring patterns and feedback quality."));

bodyContent.push(heading2("3.1 Question Generation from Job Requirements"));
bodyContent.push(codeLine("// Question generation prompt template"));
bodyContent.push(codeLine("const interviewSystemPrompt = `"));
bodyContent.push(codeLine("You are a senior technical interviewer for a {{position}} role"));
bodyContent.push(codeLine("at {{company}}. The candidate should have:"));
bodyContent.push(codeLine("- Skills: {{requiredSkills}}"));
bodyContent.push(codeLine("- Experience: {{experienceLevel}} years"));
bodyContent.push(codeLine("- Education: {{qualification}}"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("Generate one question at a time. After each response,"));
bodyContent.push(codeLine("evaluate the answer and ask a follow-up that probes"));
bodyContent.push(codeLine("deeper into areas needing clarification. Target 8-12"));
bodyContent.push(codeLine("questions over the session. Score each dimension 0-100."));
bodyContent.push(codeLine("Return evaluation as JSON after the final question.`;"));

bodyContent.push(body("The question generation engine uses a two-phase approach. In the first phase, the system prompt establishes the AI interviewer persona with the specific job context. In the second phase, each candidate response triggers an internal evaluation step where the AI assesses the response quality before generating the next question. This creates a natural interview flow where questions become progressively more challenging and targeted based on the candidate's demonstrated expertise level."));

bodyContent.push(heading2("3.2 Multi-turn Conversation Management"));
bodyContent.push(body("Multi-turn conversation management is critical for maintaining coherent interview sessions that can span 8-12 question-answer cycles. The system maintains a conversation history that includes all previous exchanges within the session, a running summary of topics covered and candidate performance per topic, and a dynamic question plan that adapts based on candidate responses. The conversation context is managed through the AIChatLog records associated with the session, which are retrieved and formatted into the message array for each API call to the language model."));

bodyContent.push(codeLine("// Conversation context management"));
bodyContent.push(codeLine("async function buildInterviewContext(sessionId: string) {"));
bodyContent.push(codeLine("  const history = await prisma.aIChatLog.findMany({"));
bodyContent.push(codeLine("    where: { sessionId, source: 'interview' },"));
bodyContent.push(codeLine("    orderBy: { createdAt: 'asc' },"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  return history.map(log => ({"));
bodyContent.push(codeLine("    role: log.role as 'user' | 'assistant',"));
bodyContent.push(codeLine("    content: log.message,"));
bodyContent.push(codeLine("  }));"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("3.3 Scoring and Assessment Dimensions"));
bodyContent.push(makeTable(
  ["Dimension", "Weight", "Score Range", "Evaluation Criteria"],
  [
    ["Technical Knowledge", "40%", "0-100", "Accuracy of technical concepts, depth of understanding, relevant examples"],
    ["Problem-Solving", "25%", "0-100", "Logical approach, analytical thinking, creative solutions, edge case awareness"],
    ["Communication", "20%", "0-100", "Clarity of expression, structured responses, active listening, conciseness"],
    ["Culture Fit", "15%", "0-100", "Value alignment, teamwork orientation, adaptability, growth mindset"],
    ["Overall Score", "Weighted", "0-100", "Weighted aggregate of all dimensions"],
  ]
));

bodyContent.push(heading2("3.4 Recommendation Generation"));
bodyContent.push(body("The final recommendation is generated by mapping the overall aiScore to a categorical recommendation. The mapping thresholds are configurable through the AI Admin Console but default to: strong_hire for scores 85-100, hire for 70-84, no_hire for 50-69, and strong_no_hire for 0-49. These recommendations are stored in the aiFeedback JSON field on the Interview model alongside the detailed assessment, enabling recruiters and hiring managers to quickly understand the AI's evaluation while retaining access to the granular scoring breakdown."));

bodyContent.push(codeLine("// Score to recommendation mapping"));
bodyContent.push(codeLine("function scoreToRecommendation(score: number): string {"));
bodyContent.push(codeLine("  if (score >= 85) return 'strong_hire';"));
bodyContent.push(codeLine("  if (score >= 70) return 'hire';"));
bodyContent.push(codeLine("  if (score >= 50) return 'no_hire';"));
bodyContent.push(codeLine("  return 'strong_no_hire';"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("3.5 Integration with Interview and JobPosting Models"));
bodyContent.push(body("The AI Interview module integrates with two primary Prisma models. The Interview model stores the interview session data including interviewType (which can be 'ai' for AI-conducted interviews), scheduledDate, duration, aiScore (float for the overall score), and aiFeedback (Json field for the detailed assessment report). The JobPosting model provides the job context including title, department, requirements (string array), skillsRequired, experienceRequired, and qualification requirements. The API route at /api/ai-interview handles session creation, message exchange, and final evaluation generation, with all interactions persisted to AIChatLog for auditability."));

bodyContent.push(heading2("3.6 Performance Considerations"));
bodyContent.push(bulletItem("Average interview session generates 15-25 API calls (8-12 questions + evaluations)"));
bodyContent.push(bulletItem("Total token consumption per session: approximately 15,000-25,000 tokens"));
bodyContent.push(bulletItem("Recommended max concurrent sessions: 10 per tenant to manage rate limits"));
bodyContent.push(bulletItem("Session timeout: 30 minutes of inactivity triggers automatic session completion"));

bodyContent.push(heading2("3.7 Limitations and Mitigations"));
bodyContent.push(bulletItem("AI cannot assess non-verbal communication cues; mitigated by focusing evaluation on verbal content quality"));
bodyContent.push(bulletItem("Coding exercise evaluation is limited to conceptual explanations; practical coding tests should supplement AI interviews"));
bodyContent.push(bulletItem("Bias in question generation toward common tech stacks; mitigated by role-specific prompt templates"));
bodyContent.push(bulletItem("Session context window limits may truncate very long interviews; mitigated by conversation summarization"));

bodyContent.push(heading2("3.8 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Voice-based AI interviews with speech-to-text integration for natural conversation flow"));
bodyContent.push(bulletItem("Code execution sandbox for real-time coding assessment during interviews"));
bodyContent.push(bulletItem("Multi-interviewer consensus: Aggregate AI and human interviewer scores into unified recommendations"));
bodyContent.push(bulletItem("Interview difficulty adaptation: Dynamically adjust question difficulty based on real-time performance"));

// ══════════════════════════════════════════
// Chapter 4: AI Assistant Module
// ══════════════════════════════════════════
bodyContent.push(heading1("4. AI Assistant Module"));

bodyContent.push(body("The AI Assistant Module provides an intelligent HR chatbot that serves as the primary AI-powered self-service interface for employees, managers, and HR administrators within NEXUS HRMS. Implemented at src/app/(dashboard)/ai-assistant/page.tsx with the API endpoint at src/app/api/ai-chat/route.ts, the module delivers context-aware responses to HR-related queries ranging from policy questions and leave balance inquiries to onboarding guidance and performance review preparation. The assistant combines natural language understanding with structured HR knowledge base access to provide accurate, citation-backed responses."));

bodyContent.push(body("The module's core capability is intent detection, which classifies user queries into actionable categories such as leave_policy, payroll_inquiry, benefits_question, onboarding_help, performance_guidance, and general_hr. Intent detection operates as a two-stage process: first, a lightweight classification model assigns a primary intent with a confidence score; second, if the confidence falls below a configurable threshold (default 0.7), the system falls back to a general knowledge response and logs the low-confidence interaction for prompt template improvement. Detected intents trigger module-specific response templates that pull relevant data from the HR knowledge base, employee records, and company policies."));

bodyContent.push(body("Context management for multi-turn conversations ensures that follow-up questions are understood within the conversational context. The system maintains a sliding window of the last 10 messages per session, with automatic summarization of older context when the token budget is exceeded. Each message in the AIChatLog includes the detected intent, confidence score, and source module reference, enabling the context engine to track topic continuity and detect subject shifts. When a user changes topics mid-conversation, the assistant gracefully transitions by acknowledging the context switch and providing a relevant response to the new query."));

bodyContent.push(body("The escalation framework provides a safety net for queries that exceed the AI's capability or require human judgment. When the confidence score falls below the escalation threshold (default 0.5), the system automatically routes the conversation to an available HR agent and provides the agent with a summary of the conversation context. The assistant also supports explicit escalation triggers such as keywords related to harassment, discrimination, or legal matters that require immediate human attention regardless of the AI's confidence level."));

bodyContent.push(heading2("4.1 Intent Detection System"));
bodyContent.push(makeTable(
  ["Intent Category", "Example Queries", "Response Source", "Confidence Threshold"],
  [
    ["leave_policy", "How many sick days do I have?", "LeavePolicy + Employee balance", "0.7"],
    ["payroll_inquiry", "When is the next payday?", "Payroll schedule + Company config", "0.75"],
    ["benefits_question", "What is covered under health insurance?", "Benefits catalog + Policy docs", "0.7"],
    ["onboarding_help", "What documents do I need to submit?", "Onboarding checklist + Company policy", "0.75"],
    ["performance_guidance", "How do I prepare for my review?", "Performance cycle + Best practices", "0.65"],
    ["compliance_query", "What are the overtime rules?", "Labor law database + Company policy", "0.8"],
    ["general_hr", "How do I update my address?", "Employee self-service guide", "0.5"],
    ["escalation", "I need to report harassment", "Immediate human routing", "0.3"],
  ]
));

bodyContent.push(heading2("4.2 Context Management Implementation"));
bodyContent.push(codeLine("// Multi-turn context window management"));
bodyContent.push(codeLine("async function buildChatContext(sessionId: string, maxMessages: number = 10) {"));
bodyContent.push(codeLine("  const messages = await prisma.aIChatLog.findMany({"));
bodyContent.push(codeLine("    where: { sessionId, source: 'chatbot' },"));
bodyContent.push(codeLine("    orderBy: { createdAt: 'desc' },"));
bodyContent.push(codeLine("    take: maxMessages,"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  return messages.reverse().map(m => ({"));
bodyContent.push(codeLine("    role: m.role,"));
bodyContent.push(codeLine("    content: m.message,"));
bodyContent.push(codeLine("    intent: m.intent,"));
bodyContent.push(codeLine("    confidence: m.confidence,"));
bodyContent.push(codeLine("  }));"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("4.3 Response Generation with Citations"));
bodyContent.push(body("Every AI Assistant response includes source citations that reference the specific policy documents, company guidelines, or HR knowledge base articles that informed the answer. The citation system operates by first retrieving relevant documents from the knowledge base using semantic similarity search, then injecting the retrieved content into the prompt context, and finally instructing the AI to attribute its statements to specific sources. Citations are rendered as inline references (e.g., [Company Leave Policy v2.1, Section 3.2]) that link to the full document in the HR knowledge base."));

bodyContent.push(heading2("4.4 Escalation and Human Handoff"));
bodyContent.push(body("The escalation system implements a three-tier routing model. Tier 1 handles routine queries that the AI can answer autonomously (confidence > 0.7). Tier 2 routes moderate-complexity queries to HR specialists with AI-suggested responses that the specialist can approve, modify, or replace. Tier 3 triggers immediate escalation to senior HR or compliance officers for sensitive matters including harassment reports, discrimination complaints, legal inquiries, and safety concerns. Each escalation level includes conversation context, detected intent, AI-generated suggested response, and urgency classification to help human agents respond efficiently."));

bodyContent.push(heading2("4.5 Session Management and Feedback"));
bodyContent.push(body("Session management tracks conversation state across multiple interactions, enabling the assistant to maintain continuity even when users close and reopen the chat interface. Each session is identified by a unique sessionId stored in the AIChatLog records. The feedback collection system prompts users to rate AI responses on a 1-5 scale and optionally provide free-text comments. This feedback is stored in the AIChatLog metadata and aggregated in the AI Admin Console to identify areas where response quality needs improvement."));

bodyContent.push(heading2("4.6 Limitations and Mitigations"));
bodyContent.push(bulletItem("Intent detection may misclassify ambiguous queries; mitigated by confidence thresholds and disambiguation prompts"));
bodyContent.push(bulletItem("Knowledge base coverage gaps for niche policy questions; mitigated by fallback to general HR knowledge + escalation"));
bodyContent.push(bulletItem("Multi-language support is limited; mitigated by language detection and English-first responses with translation options"));
bodyContent.push(bulletItem("Real-time data access (leave balance, payroll status) may have slight delays; mitigated by cache invalidation strategies"));

bodyContent.push(heading2("4.7 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Proactive notifications: AI-initiated reminders for pending tasks, policy changes, and deadlines"));
bodyContent.push(bulletItem("Multi-modal input: Support for image and document uploads for visual queries"));
bodyContent.push(bulletItem("Personalized responses: Adapt response style and detail level based on user role and interaction history"));
bodyContent.push(bulletItem("Knowledge base auto-update: Automatic ingestion of new policy documents with AI-generated summaries"));

// ══════════════════════════════════════════
// Chapter 5: AI in Recruitment
// ══════════════════════════════════════════
bodyContent.push(heading1("5. AI in Recruitment"));

bodyContent.push(body("AI-powered recruitment features in NEXUS HRMS transform the talent acquisition process by automating resume screening, enabling intelligent candidate-job matching, extracting structured skills data from unstructured resumes, analyzing source quality, and providing predictive pipeline analytics. These capabilities are integrated into the existing Recruitment module at src/app/(dashboard)/recruitment/page.tsx and operate as background AI services that enhance recruiter productivity without disrupting established workflows. The AI recruitment features use the z-ai-web-dev-sdk to process candidate data and generate actionable insights."));

bodyContent.push(body("Resume screening and ranking leverages AI to parse unstructured resume content, extract key qualifications, and compute relevance scores against job requirements. When a new application is submitted, the system automatically triggers an AI analysis pipeline that extracts the candidate's skills, years of experience, educational background, and career trajectory from the resume text. This structured data is then compared against the JobPosting requirements using a multi-factor matching algorithm that considers skill overlap, experience level alignment, educational relevance, and career progression indicators. The resulting relevance score (0-100) is stored on the JobApplication record and used to rank candidates in the recruitment pipeline."));

bodyContent.push(body("The candidate-job matching algorithm goes beyond simple keyword matching by understanding semantic relationships between skills. For instance, a candidate listing 'React' experience is recognized as relevant for a position requiring 'Frontend Development' skills, even if the exact keyword is absent. The matching engine also considers career trajectory indicators such as increasing responsibility levels, relevant project experience, and industry domain knowledge. Source quality analysis tracks which recruitment channels (website, referral, job_portal, linkedin) produce the highest-quality candidates based on AI relevance scores, enabling data-driven recruitment channel investment decisions."));

bodyContent.push(heading2("5.1 Resume Screening Pipeline"));
bodyContent.push(codeLine("// Resume screening workflow"));
bodyContent.push(codeLine("async function screenResume(applicationId: string, jobId: string) {"));
bodyContent.push(codeLine("  const application = await prisma.jobApplication.findUnique({"));
bodyContent.push(codeLine("    where: { id: applicationId },"));
bodyContent.push(codeLine("    include: { jobPosting: true },"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  const extraction = await aiClient.chat.completions.create({"));
bodyContent.push(codeLine("    messages: [{ role: 'system', content: resumeExtractionPrompt },"));
bodyContent.push(codeLine("             { role: 'user', content: application.resumeText }],"));
bodyContent.push(codeLine("    response_format: { type: 'json_object' },"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  const skills = JSON.parse(extraction.content).skills;"));
bodyContent.push(codeLine("  const matchScore = computeMatchScore(skills, application.jobPosting);"));
bodyContent.push(codeLine("  await prisma.jobApplication.update({"));
bodyContent.push(codeLine("    where: { id: applicationId },"));
bodyContent.push(codeLine("    data: { aiScore: matchScore },"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("5.2 Skills Extraction Schema"));
bodyContent.push(makeTable(
  ["Extracted Field", "Data Type", "Example", "Matching Weight"],
  [
    ["technical_skills", "string[]", "[\"React\", \"Node.js\", \"PostgreSQL\"]", "35%"],
    ["soft_skills", "string[]", "[\"Leadership\", \"Communication\"]", "15%"],
    ["years_experience", "integer", "5", "20%"],
    ["education_level", "string", "Bachelor's in Computer Science", "10%"],
    ["certifications", "string[]", "[\"AWS Solutions Architect\"]", "10%"],
    ["industry_domains", "string[]", "[\"FinTech\", \"Healthcare IT\"]", "5%"],
    ["career_trajectory", "string", "progressive_growth", "5%"],
  ]
));

bodyContent.push(heading2("5.3 Candidate-Job Matching Algorithm"));
bodyContent.push(body("The matching algorithm computes a composite score from four sub-scores: skill match (weighted 35%) measures the overlap between extracted candidate skills and required job skills using semantic similarity; experience match (20%) compares candidate experience level to the job's required experience; education match (10%) evaluates relevance of educational background; and certification match (10%) awards bonus points for relevant certifications. The algorithm also applies contextual adjustments: candidates currently employed in the same industry as the hiring company receive a domain relevance bonus (5%), and candidates showing progressive career growth receive a trajectory bonus (5%). The final score is normalized to 0-100 and used for candidate ranking."));

bodyContent.push(heading2("5.4 Source Quality Analysis"));
bodyContent.push(body("Source quality analysis aggregates AI matching scores by recruitment source to identify which channels produce the best candidates. The analysis tracks metrics including average AI score by source, conversion rate (applied to hired) by source, time-to-fill by source, and cost-per-hire by source. These metrics enable recruiters to optimize their sourcing strategy by investing more in high-quality channels and reducing spend on channels that produce low-scoring candidates. The data is visualized in the recruitment dashboard with comparison charts and trend lines."));

bodyContent.push(heading2("5.5 Pipeline Analytics Predictions"));
bodyContent.push(body("Pipeline analytics predictions use historical recruitment data and AI models to forecast key recruitment metrics: estimated time-to-fill for open positions based on current pipeline health, probability of filling each position by a target date, expected candidate flow based on seasonal patterns and channel performance, and recommended sourcing actions to improve pipeline velocity. These predictions help HR leaders make proactive decisions about resource allocation and recruitment strategy adjustments."));

bodyContent.push(heading2("5.6 Limitations and Mitigations"));
bodyContent.push(bulletItem("Resume parsing accuracy varies with document format; mitigated by multi-format parser support and manual review flags"));
bodyContent.push(bulletItem("Semantic skill matching may over-relate distant skills; mitigated by domain-specific skill taxonomies and configurable similarity thresholds"));
bodyContent.push(bulletItem("Source quality analysis requires sufficient historical data; mitigated by Bayesian priors for new channels"));
bodyContent.push(bulletItem("Predictions accuracy decreases with limited training data; mitigated by confidence intervals and explicit uncertainty communication"));

bodyContent.push(heading2("5.7 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Automated candidate outreach: AI-generated personalized messages to passive candidates"));
bodyContent.push(bulletItem("Diversity-aware matching: Ensure candidate shortlists meet diversity goals without introducing bias"));
bodyContent.push(bulletItem("Video resume analysis: Extract soft skill indicators from short video introductions"));
bodyContent.push(bulletItem("Market intelligence: Real-time salary benchmarking and talent availability insights by region"));

// ══════════════════════════════════════════
// Chapter 6: AI in Performance Management
// ══════════════════════════════════════════
bodyContent.push(heading1("6. AI in Performance Management"));

bodyContent.push(body("AI integration in the Performance Management module provides intelligent capabilities for review text analysis and summarization, goal progress prediction, skill gap identification, training recommendation generation, and performance trend analysis. These features are embedded within the existing Performance module at src/app/(dashboard)/performance/page.tsx and operate as enhancement layers that augment rather than replace the human judgment central to performance evaluation. The AI analyzes both quantitative metrics (goal completion rates, KPI scores) and qualitative data (review text, feedback narratives) to provide holistic performance insights."));

bodyContent.push(body("Review text analysis and summarization processes the often voluminous and unstructured feedback collected during performance review cycles. The AI extracts key themes, identifies sentiment patterns (positive reinforcement, constructive criticism, areas of concern), and generates concise summaries that highlight the most significant feedback points. This capability is particularly valuable for managers who need to synthesize 360-degree feedback from multiple reviewers, each providing narrative comments. The summarization preserves the nuance of individual feedback while presenting a coherent overview that supports fair and informed evaluation decisions."));

bodyContent.push(body("Goal progress prediction leverages historical performance data and current goal completion trajectories to forecast whether employees are likely to achieve their goals by the end of the review period. The prediction model considers factors such as the employee's historical goal completion rate, the complexity and scope of current goals, the time remaining in the review period, and any recent changes in performance trajectory. When the model predicts a goal is at risk, it generates proactive recommendations for corrective actions such as adjusting goal scope, providing additional resources, or scheduling check-in meetings."));

bodyContent.push(heading2("6.1 Review Text Analysis Pipeline"));
bodyContent.push(codeLine("// Review analysis prompt structure"));
bodyContent.push(codeLine("const reviewAnalysisPrompt = `"));
bodyContent.push(codeLine("Analyze the following performance review feedback"));
bodyContent.push(codeLine("and provide:"));
bodyContent.push(codeLine("1. Key themes (max 5)"));
bodyContent.push(codeLine("2. Sentiment breakdown (positive/neutral/negative ratio)"));
bodyContent.push(codeLine("3. Strengths identified (with supporting quotes)"));
bodyContent.push(codeLine("4. Areas for improvement (with specific examples)"));
bodyContent.push(codeLine("5. Overall summary (2-3 sentences)"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("Feedback: {{reviewText}}`;"));

bodyContent.push(heading2("6.2 Skill Gap Identification"));
bodyContent.push(makeTable(
  ["Analysis Dimension", "Data Source", "Output", "Action Trigger"],
  [
    ["Current skills", "Employee skills + Recent project work", "Skill inventory", "Updated per review cycle"],
    ["Required skills", "Job requirements + Industry benchmarks", "Skill requirements map", "Updated per role change"],
    ["Gap analysis", "Current vs. Required comparison", "Gap severity score (0-100)", "Score > 40 triggers recommendation"],
    ["Trend analysis", "Historical skill assessments", "Skill growth/decline trajectory", "Declining trend triggers intervention"],
    ["Peer comparison", "Anonymized team skill profiles", "Relative skill positioning", "Bottom quartile triggers coaching"],
  ]
));

bodyContent.push(heading2("6.3 Training Recommendation Engine"));
bodyContent.push(body("The training recommendation engine connects identified skill gaps to relevant learning resources from the Training module. For each skill gap, the AI generates a prioritized list of recommended training programs, courses, or certifications that address the specific competency deficiency. Recommendations are ranked by relevance score, estimated time investment, alignment with career development goals, and historical effectiveness for similar skill gaps within the organization. The engine also considers prerequisites and learning path sequencing to ensure that foundational skills are developed before advanced competencies."));

bodyContent.push(heading2("6.4 Performance Trend Analysis"));
bodyContent.push(body("Performance trend analysis visualizes employee performance trajectories over multiple review cycles, identifying patterns such as consistent improvement, plateau, or decline. The analysis considers both absolute performance scores and relative performance within peer groups. Trend insights are presented as time-series visualizations with annotations marking significant events (role changes, training completions, project milestones) that may explain performance shifts. For employees showing declining trends, the system generates early warning alerts to managers with suggested intervention strategies."));

bodyContent.push(heading2("6.5 Limitations and Mitigations"));
bodyContent.push(bulletItem("Review text analysis may miss contextual nuances in cross-cultural feedback; mitigated by culture-aware sentiment models"));
bodyContent.push(bulletItem("Goal predictions are based on historical patterns and may not account for unprecedented changes; mitigated by confidence scores"));
bodyContent.push(bulletItem("Skill gap analysis depends on accurate skill inventories; mitigated by AI-assisted skill extraction from project work"));
bodyContent.push(bulletItem("Training recommendations may not reflect the latest available courses; mitigated by periodic catalog refresh"));

bodyContent.push(heading2("6.6 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Real-time performance coaching: AI-driven micro-feedback during daily work activities"));
bodyContent.push(bulletItem("Predictive attrition modeling: Identify flight risks from performance trend patterns"));
bodyContent.push(bulletItem("Automated 360-degree feedback synthesis: AI-generated review summaries from multi-source feedback"));
bodyContent.push(bulletItem("Career path AI advisor: Personalized career development recommendations based on performance trajectory"));

// ══════════════════════════════════════════
// Chapter 7: AI in Engagement
// ══════════════════════════════════════════
bodyContent.push(heading1("7. AI in Engagement"));

bodyContent.push(body("The AI in Engagement module applies advanced natural language processing and machine learning techniques to analyze employee sentiment, predict engagement metrics, assess attrition risk, cluster survey responses, and detect anomalies in engagement scores. Integrated within the Engagement module at src/app/(dashboard)/engagement/page.tsx, these AI capabilities provide HR teams with proactive tools to monitor and improve organizational health, moving from reactive pulse surveys to predictive engagement management."));

bodyContent.push(body("Sentiment analysis operates on multiple text sources including open-ended survey responses, feedback submissions, and internal communication patterns. The AI sentiment model classifies text at three levels: document-level sentiment (overall positive, neutral, or negative), aspect-level sentiment (sentiment toward specific topics such as compensation, work-life balance, management, or growth opportunities), and entity-level sentiment (sentiment directed at specific organizational units, teams, or leadership figures). This multi-granularity approach enables HR teams to identify not just whether employees are dissatisfied, but precisely which aspects of the employee experience are driving dissatisfaction."));

bodyContent.push(body("eNPS (Employee Net Promoter Score) prediction uses historical survey data and real-time sentiment signals to forecast the next period's eNPS score before the official survey is conducted. The prediction model incorporates leading indicators such as recent feedback sentiment trends, changes in communication patterns, and attendance variations that correlate with engagement shifts. By providing an early estimate of eNPS, the system enables HR teams to take preemptive action rather than discovering engagement issues after the survey period has closed."));

bodyContent.push(heading2("7.1 Sentiment Analysis Architecture"));
bodyContent.push(makeTable(
  ["Analysis Level", "Input Source", "Output", "Update Frequency"],
  [
    ["Document-level", "Survey responses, feedback", "Positive/Neutral/Negative + score", "Per submission"],
    ["Aspect-level", "Same as above", "Sentiment per topic (compensation, culture, etc.)", "Per submission"],
    ["Entity-level", "Feedback mentioning teams/leaders", "Sentiment toward specific entities", "Per submission"],
    ["Trend-level", "Aggregated over time", "Sentiment trajectory with predictions", "Daily aggregation"],
    ["Alert-level", "Real-time analysis", "Sudden sentiment shifts triggering alerts", "Real-time"],
  ]
));

bodyContent.push(heading2("7.2 eNPS Prediction Model"));
bodyContent.push(codeLine("// eNPS prediction pipeline"));
bodyContent.push(codeLine("async function predictENPS(tenantId: string) {"));
bodyContent.push(codeLine("  const historicalSurveys = await prisma.surveyResponse.findMany({"));
bodyContent.push(codeLine("    where: { tenantId, type: 'enps' },"));
bodyContent.push(codeLine("    orderBy: { createdAt: 'desc' },"));
bodyContent.push(codeLine("    take: 12, // Last 12 months"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  const sentimentTrends = await getRecentSentiment(tenantId, 30);"));
bodyContent.push(codeLine("  const prediction = await aiClient.chat.completions.create({"));
bodyContent.push(codeLine("    messages: [{ role: 'system', content: enpsPredictionPrompt },"));
bodyContent.push(codeLine("             { role: 'user', content: JSON.stringify({"));
bodyContent.push(codeLine("               historical: historicalSurveys,"));
bodyContent.push(codeLine("               sentiment: sentimentTrends }),"));
bodyContent.push(codeLine("             }],"));
bodyContent.push(codeLine("    response_format: { type: 'json_object' },"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  return JSON.parse(prediction.content);"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("7.3 Attrition Risk Scoring"));
bodyContent.push(body("Attrition risk scoring assigns each employee a probability of leaving the organization within the next 90 days. The scoring model combines multiple signal categories: engagement signals (declining survey scores, reduced participation), behavioral signals (increased absenteeism, decreased communication frequency), career signals (stalled progression, skill- role misalignment), and external signals (industry talent demand, local job market conditions). Each signal category contributes a weighted component to the overall risk score, which ranges from 0 (minimal risk) to 100 (critical risk). High-risk employees trigger automatic notifications to their managers and HR business partners with recommended retention actions."));

bodyContent.push(makeTable(
  ["Risk Level", "Score Range", "Action", "Notification"],
  [
    ["Low", "0-25", "Monitor in regular cycle", "None"],
    ["Moderate", "26-50", "Manager check-in recommended", "Manager email digest"],
    ["High", "51-75", "Proactive retention intervention", "Manager + HRBP alert"],
    ["Critical", "76-100", "Immediate retention action required", "Manager + HRBP + HR Director alert"],
  ]
));

bodyContent.push(heading2("7.4 Survey Response Clustering"));
bodyContent.push(body("Survey response clustering uses unsupervised machine learning to identify natural groupings within employee survey responses that may not be captured by predefined categories. The clustering algorithm processes open-ended text responses, converts them to vector embeddings, and groups semantically similar responses together. This reveals emergent themes and concerns that structured survey questions might miss. Each cluster is automatically labeled with a summary generated by the AI, and cluster sizes help HR teams prioritize which themes to address first. The clustering results are visualized as interactive bubble charts where bubble size represents cluster prevalence and color represents average sentiment."));

bodyContent.push(heading2("7.5 Anomaly Detection in Engagement Scores"));
bodyContent.push(body("Anomaly detection identifies unusual patterns in engagement metrics that deviate significantly from expected baselines. The system monitors department-level and team-level engagement scores, comparing current values against historical baselines adjusted for seasonal patterns. When a metric deviates beyond two standard deviations from the expected range, an anomaly alert is generated with contextual information including the specific metric, the magnitude of the deviation, the affected team or department, and potential contributing factors identified through correlation analysis. This enables HR teams to investigate and address engagement issues before they escalate."));

bodyContent.push(heading2("7.6 Limitations and Mitigations"));
bodyContent.push(bulletItem("Sentiment analysis may misinterpret sarcasm or cultural idioms; mitigated by continuous model refinement with labeled data"));
bodyContent.push(bulletItem("eNPS predictions are estimates with inherent uncertainty; mitigated by confidence intervals and regular recalibration"));
bodyContent.push(bulletItem("Attrition risk scores may create self-fulfilling prophecies if employees learn their scores; mitigated by strict access controls"));
bodyContent.push(bulletItem("Clustering quality depends on response volume; mitigated by minimum sample size requirements and Bayesian smoothing"));

bodyContent.push(heading2("7.7 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Real-time engagement monitoring: Continuous sentiment tracking from multiple data sources"));
bodyContent.push(bulletItem("Personalized engagement interventions: AI-tailored action plans for at-risk employees"));
bodyContent.push(bulletItem("Organizational network analysis: Map informal communication patterns to identify engagement influencers"));
bodyContent.push(bulletItem("Predictive wellness scoring: Early identification of burnout risk from behavioral signals"));

// ══════════════════════════════════════════
// Chapter 8: AI Chat Log Management
// ══════════════════════════════════════════
bodyContent.push(heading1("8. AI Chat Log Management"));

bodyContent.push(body("The AIChatLog model serves as the central audit trail for all AI interactions within NEXUS HRMS. Every message exchanged between users and AI systems, whether through the Interview module, the Assistant chatbot, or any other AI-powered feature, is persisted in the AIChatLog table. This comprehensive logging enables conversation archival and retrieval, analytics on AI interactions, quality assessment of AI responses, and the creation of a training data improvement pipeline. The model is defined in the Prisma schema and is referenced by all AI modules as the authoritative record of AI-mediated communication."));

bodyContent.push(body("The AIChatLog model structure captures the full context of each interaction. The userId field identifies the user involved, while the sessionId groups messages within a single conversation. The role field distinguishes between 'user' and 'assistant' messages, and the message field stores the complete text content. The intent field records the detected intent for user messages, providing a classification layer that supports analytics and quality assessment. The confidence field stores the confidence score of the AI's response or intent classification, enabling identification of low-confidence interactions that may require human review. The source field categorizes the interaction by originating module (chatbot, interview, copilot), and the metadata JSON field captures additional contextual information such as evaluation scores, detected topics, response timing, and token counts."));

bodyContent.push(body("Conversation archival and retrieval implements a tiered storage strategy. Recent conversations (within 90 days) are stored in the primary database for fast access. Older conversations are archived to cold storage with a summary index that enables efficient search and retrieval. The archival process runs as a scheduled background job that compresses conversation batches and migrates them to the archive tier while maintaining searchability through metadata indexes. Users can retrieve their conversation history through the AI Assistant interface, and administrators can access all conversations through the AI Admin Console for auditing purposes."));

bodyContent.push(heading2("8.1 AIChatLog Model Structure"));
bodyContent.push(codeLine("// AIChatLog Prisma model"));
bodyContent.push(codeLine("model AIChatLog {"));
bodyContent.push(codeLine("  id          String   @id @default(uuid())"));
bodyContent.push(codeLine("  userId      String"));
bodyContent.push(codeLine("  sessionId   String"));
bodyContent.push(codeLine("  role        String   // 'user' | 'assistant' | 'system'"));
bodyContent.push(codeLine("  message     String   // Full message content"));
bodyContent.push(codeLine("  intent      String?  // Detected intent classification"));
bodyContent.push(codeLine("  confidence  Float?   // Confidence score (0.0-1.0)"));
bodyContent.push(codeLine("  source      String   // 'chatbot' | 'interview' | 'copilot'"));
bodyContent.push(codeLine("  metadata    Json?    // Additional context (scores, tokens, timing)"));
bodyContent.push(codeLine("  createdAt   DateTime @default(now())"));
bodyContent.push(codeLine("  tenantId    String"));
bodyContent.push(codeLine("  user        User     @relation(fields: [userId], references: [id])"));
bodyContent.push(codeLine("  tenant      Tenant   @relation(fields: [tenantId], references: [id])"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("8.2 Analytics on AI Interactions"));
bodyContent.push(makeTable(
  ["Metric", "Query Pattern", "Aggregation", "Use Case"],
  [
    ["Daily active users", "COUNT(DISTINCT userId) per day", "Time series", "Adoption tracking"],
    ["Messages per session", "COUNT(*) GROUP BY sessionId", "Distribution", "Session depth analysis"],
    ["Intent distribution", "COUNT(*) GROUP BY intent", "Pie chart", "Topic popularity"],
    ["Confidence distribution", "AVG(confidence) GROUP BY source", "Histogram", "Quality monitoring"],
    ["Response time", "metadata.responseTimeMs", "p50, p95, p99", "Performance monitoring"],
    ["Token consumption", "SUM(metadata.totalTokens)", "Time series", "Cost tracking"],
    ["Escalation rate", "COUNT(escalated) / COUNT(*)", "Trend", "Coverage analysis"],
  ]
));

bodyContent.push(heading2("8.3 Quality Assessment of AI Responses"));
bodyContent.push(body("Quality assessment operates on multiple dimensions: factual accuracy (does the response contain correct information?), completeness (does it address all aspects of the query?), relevance (is the response on-topic?), clarity (is the response well-structured and understandable?), and helpfulness (does the response provide actionable guidance?). Each dimension is evaluated through a combination of automated metrics (schema compliance, response length, citation presence) and user feedback (thumbs up/down, star ratings, free-text comments). Low-quality responses are flagged for review and used to improve prompt templates through the training data improvement pipeline."));

bodyContent.push(heading2("8.4 Training Data Improvement Pipeline"));
bodyContent.push(body("The training data improvement pipeline transforms quality assessment findings into actionable prompt template improvements. The pipeline follows a four-stage process: identification (flag low-quality interactions based on confidence scores and feedback), analysis (categorize failure modes such as hallucination, off-topic, incomplete, or incorrect), improvement (generate revised prompt templates that address identified failure modes), and validation (A/B test the improved template against the current template using a held-out evaluation dataset). This continuous improvement cycle ensures that AI response quality improves over time based on real-world usage data."));

bodyContent.push(heading2("8.5 Limitations and Mitigations"));
bodyContent.push(bulletItem("Storage growth from comprehensive logging; mitigated by tiered archival and configurable retention policies"));
bodyContent.push(bulletItem("Query performance degrades with large datasets; mitigated by database indexing on sessionId, userId, source, and createdAt"));
bodyContent.push(bulletItem("Privacy concerns from storing conversation content; mitigated by PII redaction pipeline and access controls"));
bodyContent.push(bulletItem("Training data pipeline requires manual validation; mitigated by automated quality scoring with human review for edge cases"));

bodyContent.push(heading2("8.6 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Automated prompt optimization: ML-driven prompt template generation from quality assessment data"));
bodyContent.push(bulletItem("Cross-tenant anonymized insights: Aggregate AI interaction patterns across tenants for industry benchmarks"));
bodyContent.push(bulletItem("Real-time quality monitoring: Streaming quality assessment with instant alerting for degradation"));
bodyContent.push(bulletItem("Compliance reporting: Automated generation of AI interaction audit reports for regulatory requirements"));

// ══════════════════════════════════════════
// Chapter 9: AI Security & Ethics
// ══════════════════════════════════════════
bodyContent.push(heading1("9. AI Security & Ethics"));

bodyContent.push(body("AI Security and Ethics governance in NEXUS HRMS establishes the frameworks, policies, and technical controls that ensure AI systems operate fairly, transparently, and responsibly. As an AI-powered HR platform handling sensitive employee data and making decisions that impact people's careers and livelihoods, NEXUS HRMS implements comprehensive safeguards across bias detection and mitigation, fairness in AI scoring, privacy in AI interactions, transparency requirements, human-in-the-loop review processes, and AI decision explainability. These safeguards are not optional additions but foundational requirements that are integrated into every AI module from design through deployment."));

bodyContent.push(body("Bias detection and mitigation is a critical concern for AI systems in the HR domain, where algorithmic bias can perpetuate or amplify existing inequities in hiring, performance evaluation, and career development. The platform implements a multi-layered bias mitigation strategy: pre-processing bias mitigation ensures that training data and prompt templates are reviewed for demographic biases; in-processing mitigation applies fairness constraints during model inference to prevent protected attributes (gender, ethnicity, age) from influencing outcomes; and post-processing mitigation audits AI outputs for disparate impact across demographic groups. Regular bias audits are conducted by the AI Admin Console, which generates fairness reports comparing AI scores across demographic categories."));

bodyContent.push(body("Fairness in AI scoring requires that automated evaluation systems produce equitable outcomes regardless of an individual's demographic characteristics. The platform enforces fairness through structured evaluation rubrics that define scoring criteria independent of demographic factors, blind evaluation modes where the AI does not have access to demographic information in the candidate/employee data, and statistical parity checks that flag scoring distributions showing significant variance across protected groups. When fairness violations are detected, the system generates corrective recommendations and can be configured to require human review for affected scores before they are finalized."));

bodyContent.push(heading2("9.1 Bias Detection Framework"));
bodyContent.push(makeTable(
  ["Bias Type", "Detection Method", "Mitigation Strategy", "Review Frequency"],
  [
    ["Gender bias", "Score distribution comparison across genders", "Gender-blind evaluation mode + prompt constraints", "Monthly"],
    ["Ethnicity bias", "Statistical parity difference analysis", "Demographic feature exclusion + outcome auditing", "Monthly"],
    ["Age bias", "Correlation analysis between age and scores", "Age-agnostic scoring rubrics + calibration", "Quarterly"],
    ["Education bias", "Score variance by educational background", "Experience-weighted evaluation + skills-first rubrics", "Quarterly"],
    ["Language bias", "Response quality variance by language proficiency", "Language-agnostic evaluation criteria + translation", "Quarterly"],
  ]
));

bodyContent.push(heading2("9.2 Privacy in AI Interactions"));
bodyContent.push(body("Privacy protection in AI interactions follows the principle of data minimization: AI modules should only access the minimum data necessary to fulfill their function. The platform implements data access controls that restrict AI modules from retrieving employee data beyond their operational scope. For instance, the AI Interview module can access job requirements and candidate application data but cannot access the candidate's compensation history or personal demographic details. All AI interactions are logged with data access audit trails, and employees are informed when AI systems are processing their data through transparent disclosure policies."));

bodyContent.push(heading2("9.3 Transparency Requirements"));
bodyContent.push(body("Transparency is enforced through multiple mechanisms. All AI-generated content is clearly labeled as AI-generated in the user interface, distinguishing it from human-authored content. When AI scores or recommendations influence HR decisions, the affected individuals are notified and provided with an explanation of how the AI assessment was generated. The AI Admin Console maintains a public-facing transparency report that discloses the types of AI models used, the data categories they access, and aggregate fairness metrics. These transparency measures comply with emerging AI governance regulations and build trust with platform users."));

bodyContent.push(heading2("9.4 Human-in-the-Loop Review"));
bodyContent.push(body("The human-in-the-loop review framework ensures that AI outputs that could significantly impact individuals are reviewed by qualified human decision-makers before being finalized. The review triggers are configurable per module: in the Interview module, AI recommendations of strong_no_hire require human review before the candidate is rejected; in the Performance module, any AI-generated performance score below a threshold triggers a manager review; and in the Engagement module, attrition risk alerts require HR business partner acknowledgment before retention actions are initiated. The review workflow includes the AI's reasoning, supporting evidence, and alternative interpretations to help reviewers make informed decisions."));

bodyContent.push(heading2("9.5 AI Decision Explainability"));
bodyContent.push(codeLine("// Explainability output structure"));
bodyContent.push(codeLine("interface AIExplanation {"));
bodyContent.push(codeLine("  decision: string;          // The AI's recommendation"));
bodyContent.push(codeLine("  confidence: number;        // Overall confidence (0-1)"));
bodyContent.push(codeLine("  factors: Factor[];         // Contributing factors with weights"));
bodyContent.push(codeLine("  evidence: Evidence[];      // Supporting evidence from the conversation"));
bodyContent.push(codeLine("  alternatives: string[];    // Alternative interpretations considered"));
bodyContent.push(codeLine("  dataSources: string[];     // Data sources accessed for this decision"));
bodyContent.push(codeLine("  modelVersion: string;      // AI model version for reproducibility"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("9.6 Limitations and Mitigations"));
bodyContent.push(bulletItem("Bias detection is only as effective as the audit data available; mitigated by regular demographic data collection with consent"));
bodyContent.push(bulletItem("Fairness constraints may reduce model accuracy; mitigated by Pareto-optimal fairness-accuracy tradeoff analysis"));
bodyContent.push(bulletItem("Human reviewers may rubber-stamp AI recommendations; mitigated by mandatory review time and accountability tracking"));
bodyContent.push(bulletItem("Explainability for complex models is inherently limited; mitigated by interpretable model architectures where possible"));

bodyContent.push(heading2("9.7 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Automated bias testing: Continuous bias monitoring with real-time alerting for fairness violations"));
bodyContent.push(bulletItem("Federated fairness learning: Improve bias detection across tenants without sharing raw demographic data"));
bodyContent.push(bulletItem("Regulatory compliance engine: Automated checks against emerging AI governance regulations (EU AI Act, NYC AEDT)"));
bodyContent.push(bulletItem("Ethics review board tools: Digital workflow for AI ethics committee review and approval processes"));

// ══════════════════════════════════════════
// Chapter 10: AI Integration Patterns
// ══════════════════════════════════════════
bodyContent.push(heading1("10. AI Integration Patterns"));

bodyContent.push(body("This chapter documents the common integration patterns used across all AI modules in NEXUS HRMS, providing a reference for developers implementing new AI-powered features or maintaining existing ones. The patterns cover SDK initialization and configuration, chat completions API usage, streaming responses, error handling and fallback strategies, caching strategies, and rate limiting implementation. These patterns represent the accumulated best practices from the existing AI modules and should be followed consistently to ensure reliability, performance, and maintainability."));

bodyContent.push(body("SDK initialization follows a lazy singleton pattern where the AI client is created on first use and reused for subsequent requests within the same serverless function invocation. The client is configured with tenant-specific settings retrieved from the database, including the API key, model selection, and default generation parameters. For serverless environments like Vercel, where function instances are ephemeral, the initialization pattern includes graceful fallback when environment variables are not available and circuit breaker logic to prevent cascading failures when the AI service is unavailable. Each API route that uses AI functionality imports a shared initialization module that ensures consistent client configuration."));

bodyContent.push(body("The chat completions API is the primary interface for all AI interactions in the platform. The standard usage pattern involves constructing a message array with the system prompt, conversation context, and current user query; calling the completions endpoint with the appropriate model configuration; parsing the response according to the expected schema; validating the parsed output; and handling any errors or malformed responses. For features requiring structured output (scoring, evaluation, classification), the response_format parameter enforces JSON schema compliance, significantly reducing parsing errors and enabling automated validation pipelines."));

bodyContent.push(heading2("10.1 SDK Initialization and Configuration"));
bodyContent.push(codeLine("// Shared AI client initialization"));
bodyContent.push(codeLine("import { ZAI } from 'z-ai-web-dev-sdk';"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("let clientInstance: ZAI | null = null;"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("export async function getAIClient(tenantId: string): Promise<ZAI> {"));
bodyContent.push(codeLine("  if (!clientInstance) {"));
bodyContent.push(codeLine("    const config = await prisma.aIConfig.findFirst({"));
bodyContent.push(codeLine("      where: { tenantId, isActive: true }"));
bodyContent.push(codeLine("    });"));
bodyContent.push(codeLine("    clientInstance = new ZAI({"));
bodyContent.push(codeLine("      apiKey: process.env.ZAI_API_KEY!,"));
bodyContent.push(codeLine("      model: config?.model || 'gpt-4',"));
bodyContent.push(codeLine("      temperature: config?.temperature ?? 0.5,"));
bodyContent.push(codeLine("      maxTokens: config?.max_tokens ?? 2048,"));
bodyContent.push(codeLine("    });"));
bodyContent.push(codeLine("  }"));
bodyContent.push(codeLine("  return clientInstance;"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("10.2 Chat Completions API Usage"));
bodyContent.push(codeLine("// Standard chat completion pattern"));
bodyContent.push(codeLine("async function aiChatCompletion("));
bodyContent.push(codeLine("  messages: ChatMessage[],"));
bodyContent.push(codeLine("  config: AIConfig"));
bodyContent.push(codeLine("): Promise<AIResponse> {"));
bodyContent.push(codeLine("  const client = await getAIClient(config.tenantId);"));
bodyContent.push(codeLine("  const startTime = Date.now();"));
bodyContent.push(codeLine("  try {"));
bodyContent.push(codeLine("    const response = await client.chat.completions.create({"));
bodyContent.push(codeLine("      messages,"));
bodyContent.push(codeLine("      model: config.model,"));
bodyContent.push(codeLine("      temperature: config.temperature,"));
bodyContent.push(codeLine("      max_tokens: config.max_tokens,"));
bodyContent.push(codeLine("      response_format: { type: 'json_object' },"));
bodyContent.push(codeLine("    });"));
bodyContent.push(codeLine("    const elapsed = Date.now() - startTime;"));
bodyContent.push(codeLine("    await logAIInteraction(messages, response, elapsed, config);"));
bodyContent.push(codeLine("    return parseAndValidate(response, config.responseSchema);"));
bodyContent.push(codeLine("  } catch (error) {"));
bodyContent.push(codeLine("    await logAIError(error, messages, config);"));
bodyContent.push(codeLine("    throw new AIServiceError('Chat completion failed', error);"));
bodyContent.push(codeLine("  }"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("10.3 Streaming Responses"));
bodyContent.push(body("Streaming responses are used for interactive AI features like the Assistant chatbot where real-time token delivery provides a significantly better user experience. The streaming pattern uses server-sent events (SSE) to deliver tokens to the client as they are generated. The server-side implementation wraps the SDK's streaming API in a ReadableStream that emits SSE-formatted events. The client-side implementation uses the EventSource API or a fetch-based streaming reader to consume tokens and render them incrementally. Error handling for streaming responses includes timeout detection for stalled streams, automatic reconnection logic, and graceful degradation to synchronous responses when streaming fails."));

bodyContent.push(codeLine("// Streaming response pattern"));
bodyContent.push(codeLine("export async function POST(request: Request) {"));
bodyContent.push(codeLine("  const { messages, sessionId } = await request.json();"));
bodyContent.push(codeLine("  const client = await getAIClient(tenantId);"));
bodyContent.push(codeLine("  const stream = await client.chat.completions.create({"));
bodyContent.push(codeLine("    messages, stream: true,"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  const encoder = new TextEncoder();"));
bodyContent.push(codeLine("  const readable = new ReadableStream({"));
bodyContent.push(codeLine("    async start(controller) {"));
bodyContent.push(codeLine("      for await (const chunk of stream) {"));
bodyContent.push(codeLine("        const token = chunk.choices[0]?.delta?.content || '';"));
bodyContent.push(codeLine("        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\\n\\n`));"));
bodyContent.push(codeLine("      }"));
bodyContent.push(codeLine("      controller.enqueue(encoder.encode('data: [DONE]\\n\\n'));"));
bodyContent.push(codeLine("      controller.close();"));
bodyContent.push(codeLine("    }"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("  return new Response(readable, {"));
bodyContent.push(codeLine("    headers: { 'Content-Type': 'text/event-stream' }"));
bodyContent.push(codeLine("  });"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("10.4 Error Handling and Fallbacks"));
bodyContent.push(makeTable(
  ["Error Type", "Detection", "Fallback Strategy", "Recovery"],
  [
    ["Timeout", "Request exceeds timeout threshold", "Return cached response or generic message", "Retry with exponential backoff"],
    ["Rate limit", "429 status from AI provider", "Queue request with priority", "Auto-retry after reset window"],
    ["Invalid response", "Schema validation failure", "Return partial results with warning", "Retry with simplified prompt"],
    ["Service unavailable", "5xx status or network error", "Switch to backup model", "Circuit breaker with health check"],
    ["Quota exceeded", "Tenant token budget depleted", "Return graceful degradation message", "Alert admin + queue for next cycle"],
    ["Content filter", "Content policy violation", "Return safe alternative response", "Log for template review"],
  ]
));

bodyContent.push(heading2("10.5 Caching Strategies"));
bodyContent.push(body("Caching is implemented at three levels to optimize AI service performance and reduce costs. Level 1 is prompt caching, where frequently used system prompts are cached in memory to avoid redundant token processing on the provider side. Level 2 is response caching, where identical queries within a session window receive cached responses instead of generating new ones. The cache key is computed from the message hash, model configuration, and temperature. Level 3 is semantic caching, where semantically similar queries receive similar cached responses. Semantic caching uses vector embeddings to identify query similarity above a configurable threshold (default 0.95) and returns the cached response with a freshness indicator. All cache entries have configurable TTLs that balance freshness with performance."));

bodyContent.push(heading2("10.6 Rate Limiting Implementation"));
bodyContent.push(codeLine("// Rate limiting with token bucket algorithm"));
bodyContent.push(codeLine("class RateLimiter {"));
bodyContent.push(codeLine("  private buckets: Map<string, TokenBucket> = new Map();"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("  constructor(private maxTokens: number, private refillRate: number) {}"));
bodyContent.push(codeLine(""));
bodyContent.push(codeLine("  async acquire(key: string, tokens: number = 1): Promise<boolean> {"));
bodyContent.push(codeLine("    if (!this.buckets.has(key)) {"));
bodyContent.push(codeLine("      this.buckets.set(key, { tokens: this.maxTokens, lastRefill: Date.now() });"));
bodyContent.push(codeLine("    }"));
bodyContent.push(codeLine("    const bucket = this.buckets.get(key)!;"));
bodyContent.push(codeLine("    this.refill(bucket);"));
bodyContent.push(codeLine("    if (bucket.tokens >= tokens) {"));
bodyContent.push(codeLine("      bucket.tokens -= tokens;"));
bodyContent.push(codeLine("      return true;"));
bodyContent.push(codeLine("    }"));
bodyContent.push(codeLine("    return false;"));
bodyContent.push(codeLine("  }"));
bodyContent.push(codeLine("}"));

bodyContent.push(heading2("10.7 Integration Pattern Configuration"));
bodyContent.push(makeTable(
  ["Pattern", "Configuration", "Default Value", "Tunable Range"],
  [
    ["Streaming timeout", "streamTimeoutMs", "30000", "10000-60000 ms"],
    ["Retry max attempts", "maxRetries", "3", "1-5"],
    ["Retry backoff base", "retryBackoffMs", "1000", "500-5000 ms"],
    ["Cache TTL (response)", "cacheTtlMs", "300000", "60000-3600000 ms"],
    ["Cache TTL (semantic)", "semanticCacheTtlMs", "600000", "300000-7200000 ms"],
    ["Rate limit (per tenant)", "tenantRateLimit", "100/min", "10-1000/min"],
    ["Rate limit (per feature)", "featureRateLimit", "30/min", "5-200/min"],
    ["Circuit breaker threshold", "circuitBreakerFailures", "5", "3-10"],
    ["Circuit breaker reset", "circuitBreakerResetMs", "60000", "30000-300000 ms"],
  ]
));

bodyContent.push(heading2("10.8 Limitations and Mitigations"));
bodyContent.push(bulletItem("Cache coherence issues when prompts are updated; mitigated by cache invalidation on template version changes"));
bodyContent.push(bulletItem("Rate limiting may block legitimate burst traffic; mitigated by burst allowance and priority queuing"));
bodyContent.push(bulletItem("Streaming errors may leave sessions in inconsistent states; mitigated by session state recovery logic"));
bodyContent.push(bulletItem("Fallback to backup models may produce different quality; mitigated by quality-aware model routing"));

bodyContent.push(heading2("10.9 Future Enhancement Roadmap"));
bodyContent.push(bulletItem("Model routing framework: Intelligent model selection based on query complexity, cost, and latency requirements"));
bodyContent.push(bulletItem("Distributed caching: Redis-based semantic cache shared across serverless function instances"));
bodyContent.push(bulletItem("Observability integration: OpenTelemetry instrumentation for AI service monitoring and tracing"));
bodyContent.push(bulletItem("Async processing pipeline: Background AI processing for batch operations like bulk resume screening"));

// ══════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ══════════════════════════════════════════

const pgSize = { width: 11906, height: 16838, orientation: "portrait" };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
          size: 24,
          color: P.body,
        },
        paragraph: {
          spacing: { line: 312 },
        },
      },
      heading1: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 32,
          bold: true,
          color: P.primary,
        },
      },
      heading2: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 28,
          bold: true,
          color: P.primary,
        },
      },
      heading3: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 26,
          bold: true,
          color: P.primary,
        },
      },
    },
  },
  sections: [
    // Section 1: Cover (no page number)
    {
      properties: {
        page: {
          size: pgSize,
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCoverR1(),
    },
    // Section 2: Front matter (TOC) - Roman numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary, font: { ascii: "Times New Roman" } })],
          })],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { eastAsia: "SimHei", ascii: "Times New Roman" }, color: P.primary })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"", italics: true, size: 18, color: "888888" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3: Body - Arabic numerals starting from 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      footers: {
        default: pageNumFooter(),
      },
      children: bodyContent,
    },
  ],
});

// ── Generate DOCX ──
const OUTPUT = "/home/z/my-project/download/NEXUS-HRMS-AI-Documentation.docx";

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Document generated: " + OUTPUT);
}).catch(err => {
  console.error("Generation error:", err);
  process.exit(1);
});
