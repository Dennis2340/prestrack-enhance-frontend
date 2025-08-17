import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "@/db";
import { Role } from "@prisma/client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data_summary, column_statistics, correlations, sample_rows, fileName } = body || {};

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
          businessId: businessIdEnv || "safulpay-id",
        },
      });
    }

    const system = `You are a principal data scientist. Produce a comprehensive, practical analysis for non-technical stakeholders and data teams. Use only the provided metadata (do not invent columns).
Return ONLY JSON (no prose, no markdown) that matches exactly this shape:
{
  "summary": string,
  "key_insights": string[],
  "actionable_recommendations": { "recommendation": string, "rationale": string }[],
  "visualization_recommendations": { "chart_type": string, "title": string, "description": string, "columns": string[] }[]
}
Requirements:
- Provide a concise executive summary (3-5 sentences) covering overall data shape, quality, and notable trends.
- key_insights: At least 8 specific bullet points, prioritizing: missingness, outliers, distribution shape/skew, ranges, high-cardinality columns, categorical imbalance, potential data leakage, data type issues, time trends (if any date cols), and top correlations with clear directionality.
- actionable_recommendations: At least 8 items. Include: imputation strategy per column type, normalization/standardization needs, encoding strategies for categoricals, deduplication checks, date handling (time zones/granularity), outlier treatment options, target definition guidance (if inferable), segmentation ideas, and validation steps.
- visualization_recommendations: 6–8 charts. Include histograms for key numeric features, bar charts for categorical distributions (limited to 10-15 categories), box plots for outliers, correlation heatmap suggestions, and time-series lines if date columns exist. Use existing column names only.
Constraints:
- Be domain-agnostic and avoid hallucinations.
- Use clear, direct language and keep items concise but informative.
- If information is insufficient for a point, state the limitation and propose how to collect/compute it.`;

    const userMsg = {
      role: "user",
      content: JSON.stringify({ data_summary, column_statistics, correlations, sample_rows }, null, 2),
    } as const;

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: system },
        userMsg,
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

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
      return NextResponse.json({ ai_analysis: ai, id: saved.id });
    } catch (persistErr) {
      console.warn("Persisting analysis failed; returning insights anyway.", persistErr);
      return NextResponse.json({ ai_analysis: ai, id: null });
    }
  } catch (err) {
    console.error("/api/analytics/analyze error", err);
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  }
}
