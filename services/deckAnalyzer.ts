import { OpenAI } from "openai";
import { DeckAnalysisResponse } from "../types/lorcanaDeck";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeDeck(deckInput: any[]): Promise<DeckAnalysisResponse> {
  const prompt = `
Você é um especialista em Lorcana. Analise o seguinte deck e retorne um JSON seguindo exatamente este schema:
{
  "deck_name": string,
  "author": string,
  "total_cards": number,
  "cards": [
    {
      "name": string,
      "type": "Character" | "Item" | "Action",
      "cost": number,
      "rarity": "Common" | "Rare" | "Epic" | "Legendary",
      "faction": string,
      "abilities": string[],
      "count": number
    }
  ],
  "mana_curve": { "1": number, "2": number, "3": number, "4": number, "5": number, "6+": number },
  "deck_stats": {
    "average_cost": number,
    "total_rarity_points": number,
    "faction_distribution": { [faction: string]: number }
  },
  "recommendations": [
    { "card_to_add"?: string, "card_to_remove"?: string, "reason": string }
  ]
}

Deck a ser analisado: ${JSON.stringify(deckInput)}

Retorne apenas o JSON sem explicações.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Você é um assistente especialista em Lorcana." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3
  });

  const textResponse = response.choices[0].message?.content;
  if (!textResponse) throw new Error("IA não retornou resposta");

  try {
    const deckAnalysis: DeckAnalysisResponse = JSON.parse(textResponse);
    return deckAnalysis;
  } catch (err) {
    console.error("Erro ao parsear JSON da IA:", textResponse);
    throw err;
  }
}
