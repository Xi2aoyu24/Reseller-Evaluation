import { createClient } from "@supabase/supabase-js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from "docx";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function formatChinaTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .format(new Date(value))
    .replace(/\//g, "-");
}

function formatChinaDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date(value))
    .replace(/\//g, "-");
}

function cleanInlineMarkdown(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
    String(line || "").trim()
  );
}

function isTableRow(line) {
  const s = String(line || "").trim();
  return s.includes("|") && s.split("|").length >= 3;
}

function parseTable(lines, start) {
  if (!isTableRow(lines[start]) || !isTableSeparator(lines[start + 1])) {
    return null;
  }

  const rows = [];
  let i = start;

  while (i < lines.length && isTableRow(lines[i])) {
    if (!isTableSeparator(lines[i])) {
      rows.push(
        lines[i]
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cleanInlineMarkdown(cell))
      );
    }

    i += 1;
  }

  return rows.length ? { rows, nextIndex: i } : null;
}

function makeTable(rows) {
  const colCount = Math.max(...rows.map((r) => r.length));

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
    },
    rows: rows.map((row, rowIndex) => {
      const cells = [...row];

      while (cells.length < colCount) {
        cells.push("");
      }

      return new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              width: {
                size: Math.floor(100 / colCount),
                type: WidthType.PERCENTAGE
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                      bold: rowIndex === 0
                    })
                  ]
                })
              ]
            })
        )
      });
    })
  });
}

function createPlainParagraph(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text: cleanInlineMarkdown(text),
        bold: !!options.bold
      })
    ]
  });
}

function markdownToDocxBlocks(markdown) {
  const blocks = [];
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");

  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    const table = parseTable(lines, i);

    if (table) {
      blocks.push(makeTable(table.rows));
      i = table.nextIndex;
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push(
        new Paragraph({
          text: cleanInlineMarkdown(line.replace(/^###\s+/, "")),
          heading: HeadingLevel.HEADING_3
        })
      );
    } else if (/^##\s+/.test(line)) {
      blocks.push(
        new Paragraph({
          text: cleanInlineMarkdown(line.replace(/^##\s+/, "")),
          heading: HeadingLevel.HEADING_2
        })
      );
    } else if (/^#\s+/.test(line)) {
      blocks.push(
        new Paragraph({
          text: cleanInlineMarkdown(line.replace(/^#\s+/, "")),
          heading: HeadingLevel.HEADING_1
        })
      );
    } else if (/^\s*[-*+]\s+/.test(raw)) {
      blocks.push(createPlainParagraph("• " + line.replace(/^[-*+]\s+/, "")));
    } else {
      blocks.push(createPlainParagraph(line));
    }

    i += 1;
  }

  return blocks;
}

function buildReportBlocks(record, isLast) {
  const blocks = [];

  blocks.push(
    new Paragraph({
      text: `${record.company_name || "未命名公司"} - 渠道商评估报告`,
      heading: HeadingLevel.HEADING_1
    })
  );

  blocks.push(
    new Paragraph({
      children: [
        new TextRun({ text: "创建时间：", bold: true }),
        new TextRun(formatChinaTime(record.created_at))
      ]
    })
  );

  blocks.push(
    new Paragraph({
      children: [
        new TextRun({ text: "国家/地区：", bold: true }),
        new TextRun(record.country_or_region || "")
      ]
    })
  );

  blocks.push(
    new Paragraph({
      children: [
        new TextRun({ text: "总分：", bold: true }),
        new TextRun(record.total_score == null ? "" : String(record.total_score))
      ]
    })
  );

  blocks.push(
    new Paragraph({
      children: [
        new TextRun({ text: "等级：", bold: true }),
        new TextRun(record.grade || "")
      ]
    })
  );

  blocks.push(
    new Paragraph({
      children: [
        new TextRun({ text: "分级建议：", bold: true }),
        new TextRun(record.grade_advice || "")
      ]
    })
  );

  blocks.push(
    new Paragraph({
      children: [
        new TextRun({ text: "整体置信度：", bold: true }),
        new TextRun(record.overall_confidence || "")
      ]
    })
  );

  if (record.extra_notes) {
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({ text: "补充说明：", bold: true }),
          new TextRun(record.extra_notes)
        ]
      })
    );
  }

  blocks.push(
    new Paragraph({
      text: "完整报告",
      heading: HeadingLevel.HEADING_2
    })
  );

  blocks.push(...markdownToDocxBlocks(record.result_markdown || ""));

  if (!isLast) {
    blocks.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return blocks;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Only GET method is allowed");
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from("evaluation_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return res.status(500).json({
        error: error.message,
        detail: error
      });
    }

    const records = data || [];

    const children = [
      new Paragraph({
        text: "渠道商评分报告合集",
        heading: HeadingLevel.TITLE
      }),
      new Paragraph({
        text: `导出时间：${formatChinaTime(new Date())}`
      }),
      new Paragraph({
        text: `记录数量：${records.length}`
      })
    ];

    if (records.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    records.forEach((record, index) => {
      children.push(...buildReportBlocks(record, index === records.length - 1));
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);

    const filename = `evaluation-reports-${formatChinaDate(new Date())}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
