export default async function handler(req, res) {
  // 允许你的前端页面调用这个接口
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method is allowed" });
  }

  try {
    const apiKey = process.env.DIFY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing DIFY_API_KEY. Please set it in Vercel Environment Variables."
      });
    }

    const {
      company_name,
      country_or_region,
      extra_notes
    } = req.body || {};

    if (!company_name || !country_or_region) {
      return res.status(400).json({
        error: "company_name 和 country_or_region 是必填项"
      });
    }

    const difyResponse = await fetch("https://api.dify.ai/v1/workflows/run", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {
          company_name,
          country_or_region,
          extra_notes: extra_notes || ""
        },
        response_mode: "blocking",
        user: "public-web-user"
      })
    });

    const text = await difyResponse.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!difyResponse.ok) {
      return res.status(difyResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
