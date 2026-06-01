import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Only GET method is allowed");
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from("evaluation_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return res.status(500).json({ error: error.message, detail: error });
    }

    const rows = (data || []).map((r) => ({
      "创建时间": r.created_at,
      "公司名称": r.company_name,
      "国家/地区": r.country_or_region,
      "补充说明": r.extra_notes,
      "总分": r.total_score,
      "等级": r.grade,
      "分级建议": r.grade_advice,
      "整体置信度": r.overall_confidence,
      "Markdown报告": r.result_markdown,
      "原始JSON": JSON.stringify(r.raw_json || {})
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 22 },
      { wch: 24 },
      { wch: 18 },
      { wch: 36 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 80 },
      { wch: 80 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "渠道商评分结果");

    const buffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx"
    });

    const filename = `evaluation-results-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
