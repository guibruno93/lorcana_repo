// frontend/src/DeckComparison.jsx
import React, { useState } from 'react';
import axios from 'axios';

function DeckComparison({ analysis }) {
  const [filter, setFilter] = useState('all');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!analysis || !analysis.cards) return;

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3002/api/deck-comparison/compare', {
        cards: analysis.cards,
        filter,
      });

      setResult(response.data);
    } catch (err) {
      console.error('Comparison error:', err);
      alert('Erro ao comparar deck');
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) return null;

  return (
    <div className="deck-comparison">
      <h2>📊 Comparação com Meta</h2>

      <div className="filter-buttons">
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
          Todos
        </button>
        <button onClick={() => setFilter('top32')} className={filter === 'top32' ? 'active' : ''}>
          Top 32
        </button>
        <button onClick={() => setFilter('top16')} className={filter === 'top16' ? 'active' : ''}>
          Top 16
        </button>
        <button onClick={() => setFilter('top8')} className={filter === 'top8' ? 'active' : ''}>
          Top 8
        </button>
        <button onClick={() => setFilter('top4')} className={filter === 'top4' ? 'active' : ''}>
          Top 4
        </button>
      </div>

      <button onClick={handleCompare} disabled={loading} className="compare-btn">
        {loading ? 'Comparando...' : '🔍 Comparar com Meta'}
      </button>

      {result && (
        <div className="comparison-result">
          <div className="score-display">
            <h3>Nota do Deck</h3>
            <div className="score-value">{result.comparison.score}/10</div>
            <div className="confidence">Confiança: {result.comparison.confidence}</div>
          </div>

          <div className="stats">
            <p>Similaridade média: {result.comparison.avgSimilarity}%</p>
            <p>Decks similares encontrados: {result.comparison.matchesFound}</p>
            <p>Filtro aplicado: {result.filter}</p>
          </div>

          {result.comparison.top5Matches && (
            <div className="top-matches">
              <h4>Top 5 Decks Similares:</h4>
              <ul>
                {result.comparison.top5Matches.map((match, i) => (
                  <li key={i}>
                    {match.similarity}% similar - Placement: {match.placement}
                    {match.tournament && ` - ${match.tournament}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DeckComparison;