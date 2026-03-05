import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body =
  | { kind: "ping"; bucket?: string; path?: string }
  | { kind: "cards"; bucket: string; path: string; source?: string }
  | { kind: "tournamentMeta"; bucket: string; path: string; source?: string };

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-import-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: corsHeaders,
  });
}

function errInfo(err: any) {
  return {
    message: err?.message ?? String(err),
    details: err?.details ?? null,
    hint: err?.hint ?? null,
    code: err?.code ?? null,
    status: err?.status ?? null,
    name: err?.name ?? null,
    stack: err?.stack ?? null,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { ok: false, step: "method", error: "Method not allowed" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const IMPORT_TOKEN = Deno.env.get("IMPORT_TOKEN") ?? "";

    if (!SUPABASE_URL) return json(500, { ok: false, step: "env", error: "Missing SUPABASE_URL" });
    if (!SERVICE_ROLE) return json(500, { ok: false, step: "env", error: "Missing SUPABASE_SERVICE_ROLE_KEY" });
    if (!IMPORT_TOKEN) return json(500, { ok: false, step: "env", error: "Missing IMPORT_TOKEN" });

    const token = req.headers.get("x-import-token") ?? "";
    if (token !== IMPORT_TOKEN) return json(401, { ok: false, step: "auth", error: "Invalid x-import-token" });

    const raw = await req.text();
    let body: Body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return json(400, { ok: false, step: "parse.json", error: errInfo(e), raw });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    if (body.kind === "ping") {
      const info: any = {
        ok: true,
        step: "ping",
        env: {
          hasSupabaseUrl: !!SUPABASE_URL,
          hasServiceRole: !!SERVICE_ROLE,
          hasImportToken: !!IMPORT_TOKEN,
        },
      };

      if (body.bucket && body.path) {
        const { data, error } = await supabase.storage.from(body.bucket).createSignedUrl(body.path, 60);
        if (error) return json(500, { ok: false, step: "storage.createSignedUrl", error: errInfo(error) });
        info.storageProbe = {
          signedUrlCreated: true,
          expiresIn: 60,
          urlPrefix: data?.signedUrl?.slice(0, 60) ?? null,
        };
      }

      return json(200, info);
    }

    const { data: blob, error: dlErr } = await supabase.storage.from(body.bucket).download(body.path);
    if (dlErr) return json(500, { ok: false, step: "storage.download", error: errInfo(dlErr) });

    const text = await blob.text();
    let fileJson: any;
    try {
      fileJson = JSON.parse(text);
    } catch (e) {
      return json(500, { ok: false, step: "parse.file_json", error: errInfo(e) });
    }

    if (body.kind === "cards") {
      const cards = Array.isArray(fileJson) ? fileJson : fileJson?.cards;
      if (!Array.isArray(cards)) return json(400, { ok: false, step: "cards.shape", error: "Expected array (or {cards:[]})" });

      let affected = 0;
      for (const part of chunk(cards, 400)) {
        const { data, error } = await supabase.rpc("import_cards_json", {
          cards_json: part,
          source_override: body.source ?? "dreamborn",
        });
        if (error) return json(500, { ok: false, step: "rpc.import_cards_json", error: errInfo(error) });
        affected += Number(data ?? 0);
      }
      return json(200, { ok: true, kind: "cards", affected });
    }

    if (body.kind === "tournamentMeta") {
      const decks = Array.isArray(fileJson?.decks) ? fileJson.decks : [];
      if (!Array.isArray(decks)) return json(400, { ok: false, step: "tournamentMeta.shape", error: "Expected {decks:[]}" });

      let decksAffected = 0;
      for (const part of chunk(decks, 40)) {
        const rows = part
          .filter((d: any) => d?.url)
          .map((d: any) => ({
            url: d.url,
            source_url: d.url,
            archetype: d.archetype ?? null,
            author: d.author ?? null,
            cards: d.cards ?? [],
            total_cards: d.totalQty ?? null,
            source: body.source ?? "inkdecks",
            scraped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

        if (rows.length) {
          const { error } = await supabase.from("decks").upsert(rows, { onConflict: "url" });
          if (error) return json(500, { ok: false, step: "db.upsert.decks", error: errInfo(error) });
          decksAffected += rows.length;
        }
      }
      return json(200, { ok: true, kind: "tournamentMeta", decksAffected });
    }

    return json(400, { ok: false, step: "input", error: "Invalid kind" });
  } catch (e) {
    console.error("IMPORT-JSON ERROR", e);
    return json(500, { ok: false, step: "catch", error: errInfo(e) });
  }
});