import React from "react";
import { DeckAnalysisResponse } from "../types/lorcanaDeck";

interface DeckAnalysisProps {
  analysis: DeckAnalysisResponse;
}

const DeckAnalysis: React.FC<DeckAnalysisProps> = ({ analysis }) => {
  return (
    <div style={{ marginTop: "20px" }}>
      <h2>{analysis.deck_name} (por {analysis.author})</h2>
      <p>Total de cartas: {analysis.total_cards}</p>

      <h3>Cartas:</h3>
      <ul>
        {analysis.cards.map((card, idx) => (
          <li key={idx}>
            <strong>{card.name}</strong> [{card.type}] - Custo: {card.cost}, Raridade: {card.rarity}, Facção: {card.faction}
            <br />
            Habilidades: {card.abilities.join(", ")}
            <br />
            Quantidade: {card.count}
          </li>
        ))}
      </ul>

      <h3>Curva de Mana:</h3>
      <ul>
        {Object.entries(analysis.mana_curve).map(([cost, qty]) => (
          <li key={cost}>
            Custo {cost}: {qty} cartas
          </li>
        ))}
      </ul>

      <h3>Estatísticas:</h3>
      <p>Custo médio: {analysis.deck_stats.average_cost.toFixed(2)}</p>
      <p>Total de pontos de raridade: {analysis.deck_stats.total_rarity_points}</p>
      <p>Distribuição de facções:</p>
      <ul>
        {Object.entries(analysis.deck_stats.faction_distribution).map(([faction, qty]) => (
          <li key={faction}>{faction}: {qty}</li>
        ))}
      </ul>

      <h3>Recomendações:</h3>
      <ul>
        {analysis.recommendations.map((rec, idx) => (
          <li key={idx}>
            {rec.card_to_add && <>Adicionar: {rec.card_to_add} - </>}
            {rec.card_to_remove && <>Remover: {rec.card_to_remove} - </>}
            Motivo: {rec.reason}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DeckAnalysis;
