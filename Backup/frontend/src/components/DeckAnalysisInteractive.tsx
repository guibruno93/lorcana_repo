import React, { useState } from "react";
import { DeckAnalysisResponse, DeckCard } from "../types/lorcanaDeck";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import jsPDF from "jspdf";

interface Props {
  analysis: DeckAnalysisResponse;
}

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a4de6c"];

const DeckAnalysisInteractive: React.FC<Props> = ({ analysis }) => {
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [factionFilter, setFactionFilter] = useState<string>("All");
  const [costFilter, setCostFilter] = useState<string>("All");

  // Filtrar cartas de acordo com filtros
  const filteredCards = analysis.cards.filter((card: DeckCard) => {
    return (typeFilter === "All" || card.type === typeFilter) &&
           (factionFilter === "All" || card.faction === factionFilter) &&
           (costFilter === "All" || card.cost.toString() === costFilter);
  });

  // Dados para gráficos
  const manaData = Object.entries(analysis.mana_curve).map(([cost, qty]) => ({ cost, qty }));
  const factionData = Object.entries(analysis.deck_stats.faction_distribution).map(([name, value]) => ({ name, value }));

  // Exportar PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Deck: ${analysis.deck_name}`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Autor: ${analysis.author}`, 10, 30);
    doc.text(`Total de cartas: ${analysis.total_cards}`, 10, 40);
    doc.text("Cartas:", 10, 50);
    filteredCards.forEach((card, idx) => {
      const y = 60 + idx * 10;
      doc.text(`${card.name} [${card.type}] Custo: ${card.cost}, Raridade: ${card.rarity}`, 12, y);
    });
    doc.save(`${analysis.deck_name}_analysis.pdf`);
  };

  // Filtros únicos
  const types = ["All", ...Array.from(new Set(analysis.cards.map(c => c.type)))];
  const factions = ["All", ...Array.from(new Set(analysis.cards.map(c => c.faction)))];
  const costs = ["All", ...Array.from(new Set(analysis.cards.map(c => c.cost.toString())))];

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>{analysis.deck_name} (por {analysis.author})</h2>
      <p>Total de cartas: {analysis.total_cards}</p>

      <div style={{ display: "flex", gap: "20px", marginBottom: "10px" }}>
        <label>
          Tipo:
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Facção:
          <select value={factionFilter} onChange={e => setFactionFilter(e.target.value)}>
            {factions.map(f => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label>
          Custo:
          <select value={costFilter} onChange={e => setCostFilter(e.target.value)}>
            {costs.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <button onClick={exportPDF}>Exportar PDF</button>
      </div>

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
          <Pie data={factionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {factionData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <h3>Cartas Filtradas</h3>
      <ul>
        {filteredCards.map((card, idx) => (
          <li key={idx} style={{ fontWeight: analysis.recommendations.some(r => r.card_to_add === card.name || r.card_to_remove === card.name) ? "bold" : "normal", color: analysis.recommendations.some(r => r.card_to_add === card.name) ? "green" : undefined }}>
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

export default DeckAnalysisInteractive;
