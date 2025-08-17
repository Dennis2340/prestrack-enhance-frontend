import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "@/db";
import { Role } from "@prisma/client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data_summary, column_statistics, correlations, sample_rows, fileName, model: modelOverride } = body || {};

    if (!data_summary || !column_statistics) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auth: only logged-in admins can analyze and persist
    const { getUser } = getKindeServerSession();
    const sessionUser = await getUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve admin user in our DB (by id or email). Create if missing.
    const businessIdEnv = process.env.NEXT_PUBLIC_BUSINESS_ID || null;
    let adminUser = await db.user.findUnique({ where: { id: sessionUser.id } });
    if (!adminUser && sessionUser.email) {
      adminUser = await db.user.findUnique({ where: { email: sessionUser.email } });
    }
    if (!adminUser) {
      const nameParts = [sessionUser.given_name, sessionUser.family_name].filter(Boolean);
      const fallbackName = sessionUser.email?.split("@")[0] || "Admin User";
      adminUser = await db.user.create({
        data: {
          id: sessionUser.id,
          name: nameParts.join(" ") || fallbackName,
          email: sessionUser.email || null,
          role: Role.admin,
          businessId: businessIdEnv,
        },
      });
    }

    const system = `You are a principal data scientist. Produce a highly comprehensive, practical analysis for non-technical stakeholders and data teams. Use only the provided metadata (do not invent columns).
Return ONLY JSON (no prose, no markdown) that matches exactly this shape:
{
  "summary": string,
  "key_insights": string[],
  "actionable_recommendations": { "recommendation": string, "rationale": string }[],
  "visualization_recommendations": { "chart_type": string, "title": string, "description": string, "columns": string[] }[]
}
Requirements:
- Provide a concise executive summary (3-5 sentences) covering overall data shape, quality, and notable trends.
- Provide AT LEAST 20 key insights. Cover missingness, outliers, skew, ranges, category imbalance, leakage risks, data types, correlations, time trends, seasonality, cohort differences, and segment differences if present.
- Provide AT LEAST 20 actionable recommendations. Each must include a clear recommendation and a short rationale. Include preprocessing, feature engineering, modeling approaches, segmentation, validation, and monitoring.
- Provide 10-12 visualization recommendations. Include chart type, title, short description, and columns used.
- STRICT chart_type ENUM: one of ["pie_chart", "bar_chart", "histogram", "scatter_plot"]. Use lowercase snake_case exactly.
- columns MUST be an array of existing column names. For scatter_plot include two numeric columns.
- Be concrete and avoid generic statements. Use column names verbatim. If something is not applicable, state why briefly.
- If context appears insufficient, propose additional data to collect and how it would change analysis.
- STRICT JSON ONLY.`;

    const userMsg = {
      role: "user",
      content: JSON.stringify({ data_summary, column_statistics, correlations, sample_rows }, null, 2),
    } as const;

    const primaryModel = (typeof modelOverride === "string" && modelOverride.trim()) ? modelOverride : (process.env.OPENAI_MODEL || "gpt-5");
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o";
    let usedModel = primaryModel;
    let resp;
    try {
      const reqOpts: any = {
        model: primaryModel,
        messages: [
          { role: "system", content: system },
          userMsg,
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      };
      if ((primaryModel || "").includes("gpt-5")) reqOpts.max_completion_tokens = 8000;
      else reqOpts.max_tokens = 8000;
      resp = await openai.chat.completions.create(reqOpts);
    } catch (modelErr) {
      console.warn(`Primary model failed (${primaryModel}). Retrying with fallback ${fallbackModel}.`, modelErr);
      usedModel = fallbackModel;
      const fbReqOpts: any = {
        model: fallbackModel,
        messages: [
          { role: "system", content: system },
          userMsg,
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      };
      if ((fallbackModel || "").includes("gpt-5")) fbReqOpts.max_completion_tokens = 8000;
      else fbReqOpts.max_tokens = 8000;
      resp = await openai.chat.completions.create(fbReqOpts);
    }

    const content = resp.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "LLM returned empty content" }, { status: 500 });
    }

    // Ensure it's valid JSON
    let ai;
    try {
      ai = JSON.parse(content);
      console.log("AI Analysis:", ai);
    } catch (e) {
      // Some models might add code fences—attempt to strip
      const stripped = content.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
      ai = JSON.parse(stripped);
    }

    // Normalize visualization recommendations to expected schema
    try {
      const allowed = new Set(["pie_chart", "bar_chart", "histogram", "scatter_plot"]);
      if (ai && Array.isArray(ai.visualization_recommendations)) {
        ai.visualization_recommendations = ai.visualization_recommendations
          .map((rec: any) => {
            if (!rec) return null;
            const rawType = String(rec.chart_type || '').toLowerCase().replace(/\s+/g, '_');
            const chart_type = allowed.has(rawType) ? rawType : rawType;
            let columns: string[] = Array.isArray(rec.columns) ? rec.columns.filter((c: any) => typeof c === 'string' && c.trim()).map((c: string) => c.trim()) : [];
            if (chart_type === 'scatter_plot' && columns.length > 2) columns = columns.slice(0, 2);
            return {
              chart_type,
              title: String(rec.title || '').trim() || 'Untitled',
              description: String(rec.description || '').trim() || '',
              columns,
            };
          })
          .filter((rec: any) => rec && allowed.has(rec.chart_type) && rec.columns && rec.columns.length > 0);
      }
    } catch (normErr) {
      console.warn('Failed to normalize visualization recommendations', normErr);
    }

    // Persist analysis
    const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID;
    try {
      const saved = await db.dataAnalysis.create({
        data: {
          adminId: adminUser.id,
          businessId,
          fileName: fileName || null,
          inputSummary: { data_summary, column_statistics, correlations },
          aiAnalysis: ai,
        },
        select: { id: true },
      });
      return NextResponse.json({ ai_analysis: ai, id: saved.id, used_model: usedModel });
    } catch (persistErr) {
      console.warn("Persisting analysis failed; returning insights anyway.", persistErr);
      return NextResponse.json({ ai_analysis: ai, id: null, used_model: usedModel });
    }
  } catch (err) {
    console.error("/api/analytics/analyze error", err);
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  }
}
