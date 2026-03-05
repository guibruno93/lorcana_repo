import type { NextApiRequest, NextApiResponse } from "next";
import { analyzeDeck } from "../../services/deckAnalyzer";
import { DeckAnalysisResponse } from "../../types/lorcanaDeck";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeckAnalysisResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Use POST." });
  }

  const deck = req.body.deck;
  if (!deck || !Array.isArray(deck)) {
    return res.status(400).json({ error: "Deck inválido. Envie um array de cartas." });
  }

  try {
    const analysis = await analyzeDeck(deck);
    return res.status(200).json(analysis);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao analisar o deck" });
  }
}
