import { createClient } from "@supabase/supabase-js";

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

function pickNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method is allowed" });
  }

  try {
    const body = req.body || {};

    if (!body.company_name || !body.country_or_region) {
      return res.status(400).json({
        error: "company_name 和 country_or_region 是必填项"
      });
    }

    const row = {
      company_name: body.company_name,
      country_or_region: body.country_or_region,
      extra_notes: body.extra_notes || "",
      total_score: pickNumber(body.total_score),
      grade: body.grade || "",
      grade_advice: body.grade_advice || "",
      overall_confidence: body.overall_confidence || "",
      result_markdown: body.result_markdown || "",
      raw_json: body.raw_json || {}
    };

    const { data, error } = await getSupabaseClient()
      .from("evaluation_results")
      .insert(row)
      .select("id, created_at")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message, detail: error });
    }

    return res.status(200).json({
      ok: true,
      id: data.id,
      created_at: data.created_at
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
