// supabase/functions/import-json/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  bucket: string;
  path: string;
  kind: "cards" | "tournamentMeta";
  source?: string;
  // opcional: se quiser rodar a materialização no final
  materializeDeckCards?: boolean;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// proteja essa função (não deixe público)
// use um token simples via header:
const IMPORT_TOKEN = Deno.env.get("IMPORT_TOKEN")!;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const token = req.headers.get("x-import-token");
    if (!token || token !== IMPORT_TOKEN) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json()) as Body;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // baixar do bucket
    const { data: blob, error: dlErr } = await supabase.storage
      .from(body.bucket)
      .download(body.path);
    if (dlErr) throw dlErr;

    const text = await blob.text();
    const json = JSON.parse(text);

    // importar
    if (body.kind === "cards") {
      const cards = Array.isArray(json) ? json : json.cards;
      if (!Array.isArray(cards)) throw new Error("cards.json não é um array.");

      let affected = 0;
      for (const part of chunk(cards, 400)) {
        const { data, error } = await supabase.rpc("import_cards_json", {
          cards_json: part,
          source_override: body.source ?? "dreamborn",
        });
        if (error) throw error;
        affected += Number(data ?? 0);
      }

      return Response.json({ ok: true, kind: "cards", affected });
    }

    if (body.kind === "tournamentMeta") {
      const decks = Array.isArray(json?.decks) ? json.decks : [];
      if (!Array.isArray(decks)) throw new Error("tournamentMeta.json não tem decks[].");

      let decksAffected = 0;

      // exemplo: upsert decks via RPC (se você tiver uma RPC),
      // OU use upsert direto em public.decks.
      // Aqui vou supor que você quer gravar em public.decks diretamente:
      for (const part of chunk(decks, 40)) {
        const rows = part
          .filter((d: any) => d?.url)
          .map((d: any) => ({
            // ajuste conforme seu schema:
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
          const { error } = await supabase
            .from("decks")
            .upsert(rows, { onConflict: "url" });
          if (error) throw error;
          decksAffected += rows.length;
        }
      }

      // (opcional) materializar deck_cards a partir de decks.cards
      if (body.materializeDeckCards) {
        // crie uma SQL function no banco (ex.: materialize_deck_cards())
        const { error } = await supabase.rpc("materialize_deck_cards");
        if (error) throw error;
      }

      return Response.json({ ok: true, kind: "tournamentMeta", decksAffected });
    }

    return new Response("Invalid kind", { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});