import { createClient } from "@supabase/supabase-js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak
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

function markdownToPlainText(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .trim();
}

function buildReportParagraphs(record, isLast) {
  const paragraphs = [];

  paragraphs.push(
    new Paragraph({
      text: `${record.company_name || "未命名公司"} - 渠道商评估报告`,
      heading: HeadingLevel.HEADING_1
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: "国家/地区：", bold: true }),
        new TextRun(record.country_or_region || "")
      ]
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: "总分：", bold: true }),
        new TextRun(record.total_score == null ? "" : String(record.total_score))
      ]
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: "等级：", bold: true }),
        new TextRun(record.grade || "")
      ]
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: "分级建议：", bold: true }),
        new TextRun(record.grade_advice || "")
      ]
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: "整体置信度：", bold: true }),
        new TextRun(record.overall_confidence || "")
      ]
    })
  );

  if (record.extra_notes) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: "补充说明：", bold: true }),
          new TextRun(record.extra_notes)
        ]
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      text: "完整报告",
      heading: HeadingLevel.HEADING_2
    })
  );

  const plainReport = markdownToPlainText(record.result_markdown || "");
  const lines = plainReport
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    paragraphs.push(new Paragraph({ text: line }));
  }

  if (!isLast) {
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return paragraphs;
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
      return res.status(500).json({ error: error.message, detail: error });
    }

    const records = data || [];

    const children = [
      new Paragraph({
        text: "渠道商评分报告合集",
        heading: HeadingLevel.TITLE
      }),
      new Paragraph({
        text: `导出时间：${new Date().toLocaleString("zh-CN")}`
      }),
      new Paragraph({
        text: `记录数量：${records.length}`
      })
    ];

    if (records.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    records.forEach((record, index) => {
      children.push(...buildReportParagraphs(record, index === records.length - 1));
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

    const filename = `evaluation-reports-${new Date()
      .toISOString()
      .slice(0, 10)}.docx`;

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
