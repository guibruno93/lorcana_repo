import React from "react";
import { DeckAnalysisResponse } from "../types/lorcanaDeck";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Props {
  analysis: DeckAnalysisResponse;
}

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c"];

const DeckAnalysisVisual: React.FC<Props> = ({ analysis }) => {
  const manaData = Object.entries(analysis.mana_curve).map(([cost, qty]) => ({ cost, qty }));
  const factionData = Object.entries(analysis.deck_stats.faction_distribution).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>{analysis.deck_name} (por {analysis.author})</h2>
      <p>Total de cartas: {analysis.total_cards}</p>

      <h3>Curva de Mana</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={manaData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="cost" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="qty" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>

      <h3>Distribuição de Facções</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={factionData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {factionData.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <h3>Cartas</h3>
      <ul>
        {analysis.cards.map((card, idx) => (
          <li key={idx}>
            <strong>{card.name}</strong> [{card.type}] - Custo: {card.cost}, Raridade: {card.rarity}, Facção: {card.faction}<br />
            Habilidades: {card.abilities.join(", ")}<br />
            Quantidade: {card.count}
          </li>
        ))}
      </ul>

      <h3>Recomendações</h3>
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

export default DeckAnalysisVisual;
