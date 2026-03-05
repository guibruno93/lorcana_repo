// import-data.mjs
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no env.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 1) Cards
const cards = JSON.parse(fs.readFileSync("./cards.json", "utf8"));
for (const [i, part] of chunk(cards, 400).entries()) {
  const { data, error } = await supabase.rpc("import_cards_json", {
    cards_json: part,
    source_override: "dreamborn",
  });
  if (error) throw error;
  console.log(`cards chunk ${i}: affected=${data}`);
}

// 2) Tournament meta -> decks + deck_cards
const meta = JSON.parse(fs.readFileSync("./tournamentMeta.json", "utf8"));
const decks = meta.decks ?? [];
for (const [i, part] of chunk(decks, 40).entries()) {
  const { data, error } = await supabase.rpc("import_decks_from_tournament_meta", {
    decks_json: part,
    source_override: "inkdecks",
  });
  if (error) throw error;
  console.log(`decks chunk ${i}:`, data);
}

console.log("done");