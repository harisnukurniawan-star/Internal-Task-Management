const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublishableKey() {
  const modern = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed).find((value) => typeof value === "string" && value.length > 0);
      if (first) return first;
    } catch {
      // Fall through to the legacy key if the injected JSON cannot be parsed.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

async function readTable(
  supabaseUrl: string,
  publishableKey: string,
  authorization: string,
  query: string,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${query}`, {
    headers: {
      apikey: publishableKey,
      Authorization: authorization,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase Data API ${response.status}: ${detail}`);
  }

  return (await response.json()) as JsonRecord[];
}

function compactContext(data: Record<string, JsonRecord[]>) {
  return JSON.stringify(data, null, 2);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ error: "Missing authenticated user token" }, 401);
  }

  let body: { question?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const question = body.question?.trim();
  if (!question) return json({ error: "question is required" }, 400);
  if (question.length > 6000) return json({ error: "question is too long" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = getPublishableKey();
  const xaiApiKey = Deno.env.get("XAI_API_KEY") ?? "";
  const model = body.model?.trim() || Deno.env.get("XAI_MODEL") || "grok-4.6";

  if (!supabaseUrl || !publishableKey) {
    return json({ error: "Supabase runtime configuration is unavailable" }, 503);
  }
  if (!xaiApiKey) {
    return json({
      error: "Grok connector is deployed but XAI_API_KEY has not been configured in Supabase Edge Function secrets",
      code: "XAI_API_KEY_MISSING",
    }, 503);
  }

  try {
    // Every query carries the caller's JWT. PostgREST therefore applies the same
    // Row Level Security policies as the Internal Task Management web app.
    const [profiles, employees, periods, tasks, claims, evaluations, leaderboard] = await Promise.all([
      readTable(supabaseUrl, publishableKey, authorization, "profiles?select=id,full_name,role,active&order=full_name.asc"),
      readTable(supabaseUrl, publishableKey, authorization, "employees?select=id,full_name,active,display_order&order=display_order.asc"),
      readTable(supabaseUrl, publishableKey, authorization, "weekly_periods?select=id,week_start,week_end,label,status&order=week_start.desc&limit=20"),
      readTable(supabaseUrl, publishableKey, authorization, "tasks?select=id,period_id,title,description,priority,weight,due_at,assigned_to,status,created_at,updated_at&order=updated_at.desc&limit=100"),
      readTable(supabaseUrl, publishableKey, authorization, "task_claims?select=id,task_id,employee_id,realization_summary,completion_percent,submitted_at,version,updated_at&order=submitted_at.desc&limit=100"),
      readTable(supabaseUrl, publishableKey, authorization, "task_evaluations?select=id,claim_id,score,decision,feedback,evaluated_at&order=evaluated_at.desc&limit=100"),
      readTable(supabaseUrl, publishableKey, authorization, "leaderboard_weekly?select=period_id,employee_id,total_assigned,total_submitted,total_approved,overdue_count,completion_rate,on_time_rate,avg_score,weighted_points,rank,refreshed_at&order=refreshed_at.desc&limit=100"),
    ]);

    const context = compactContext({ profiles, employees, periods, tasks, claims, evaluations, leaderboard });
    const systemPrompt = [
      "You are the read-only AI assistant for the Internal Task Management application.",
      "Answer in Indonesian unless the user asks for another language.",
      "Use only the supplied application data for claims about assignments, realization, evaluation, deadlines, or leaderboard.",
      "Never invent missing task data. If the supplied data is insufficient, say what is missing.",
      "Do not claim that you changed, approved, rejected, assigned, deleted, or otherwise mutated data; this connector is read-only.",
      "Be concise and operational. When useful, mention task titles, status, due dates, completion percentages, evaluation scores, and employee names.",
      "The data is already filtered by Supabase Row Level Security for the authenticated caller.",
    ].join("\n");

    const xaiResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: `CURRENT INTERNAL TASK MANAGEMENT DATA:\n${context}` },
          { role: "user", content: question },
        ],
      }),
    });

    if (!xaiResponse.ok) {
      const detail = (await xaiResponse.text()).slice(0, 800);
      console.error("xAI request failed", xaiResponse.status, detail);
      return json({ error: "Grok request failed", status: xaiResponse.status }, 502);
    }

    const result = await xaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: unknown;
    };
    const answer = result.choices?.[0]?.message?.content?.trim();
    if (!answer) return json({ error: "Grok returned an empty response" }, 502);

    return json({
      answer,
      provider: "xai",
      model: result.model ?? model,
      read_only: true,
      context_counts: {
        profiles: profiles.length,
        employees: employees.length,
        periods: periods.length,
        tasks: tasks.length,
        claims: claims.length,
        evaluations: evaluations.length,
        leaderboard: leaderboard.length,
      },
    });
  } catch (error) {
    console.error("grok-task-assistant failed", error);
    return json({ error: "Connector failed while reading permitted task data" }, 500);
  }
});
