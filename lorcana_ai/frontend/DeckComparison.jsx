import React, { useState } from 'react';
import axios from 'axios';
import './DeckComparison.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function DeckComparison({ analysis }) {
  const [filter, setFilter] = useState('all');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async () => {
    if (!analysis || !analysis.cards || analysis.cards.length === 0) {
      setError('Nenhum deck para comparar');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE}/api/deck-comparison/compare`, {
        cards: analysis.cards,
        filter,
      });

      setResult(response.data);
    } catch (err) {
      console.error('Comparison error:', err);
      const errorMsg = err.response?.data?.error || 'Erro ao comparar deck';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!analysis || !analysis.cards) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 8) return '#10b981'; // green
    if (score >= 6) return '#f59e0b'; // yellow
    if (score >= 4) return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  const getConfidenceBadge = (confidence) => {
    const badges = {
      high: { text: 'Alta', color: '#10b981' },
      medium: { text: 'Média', color: '#f59e0b' },
      low: { text: 'Baixa', color: '#6b7280' },
    };
    return badges[confidence] || badges.low;
  };

  return (
    <div className="deck-comparison">
      <div className="comparison-header">
        <h2>📊 Comparação com Meta</h2>
        <p className="comparison-description">
          Compare seu deck com {analysis.totalCards || 60} cards contra o meta competitivo
        </p>
      </div>

      <div className="filter-section">
        <label>Filtrar por placement:</label>
        <div className="filter-buttons">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'top32', label: 'Top 32' },
            { value: 'top16', label: 'Top 16' },
            { value: 'top8', label: 'Top 8' },
            { value: 'top4', label: 'Top 4' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`filter-btn ${filter === value ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button 
        onClick={handleCompare} 
        disabled={loading}
        className="compare-btn"
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Comparando...
          </>
        ) : (
          <>
            🔍 Comparar com Meta
          </>
        )}
      </button>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="comparison-result">
          <div className="result-grid">
            {/* Score principal */}
            <div className="score-card">
              <div className="score-header">
                <h3>Nota do Deck</h3>
                <span 
                  className="confidence-badge"
                  style={{ backgroundColor: getConfidenceBadge(result.comparison.confidence).color }}
                >
                  Confiança {getConfidenceBadge(result.comparison.confidence).text}
                </span>
              </div>
              <div 
                className="score-value"
                style={{ color: getScoreColor(result.comparison.score) }}
              >
                {result.comparison.score}
                <span className="score-max">/10</span>
              </div>
              <div className="score-bar">
                <div 
                  className="score-fill"
                  style={{ 
                    width: `${result.comparison.score * 10}%`,
                    backgroundColor: getScoreColor(result.comparison.score)
                  }}
                ></div>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="stats-card">
              <h3>Estatísticas</h3>
              <div className="stat-row">
                <span className="stat-label">Similaridade média:</span>
                <span className="stat-value">{result.comparison.avgSimilarity}%</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Decks similares encontrados:</span>
                <span className="stat-value">{result.comparison.matchesFound}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Total no meta ({filter}):</span>
                <span className="stat-value">{result.meta.totalDecks} decks</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Mesmas cores:</span>
                <span className="stat-value">{result.meta.sameInks} decks</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Cores do deck:</span>
                <span className="stat-value">{result.userDeck.inks.join(', ')}</span>
              </div>
            </div>
          </div>

          {/* Top 5 matches */}
          {result.comparison.top5Matches && result.comparison.top5Matches.length > 0 && (
            <div className="top-matches-card">
              <h3>🏆 Top 5 Decks Similares</h3>
              <div className="matches-list">
                {result.comparison.top5Matches.map((match, i) => (
                  <div key={i} className="match-item">
                    <div className="match-rank">#{i + 1}</div>
                    <div className="match-info">
                      <div className="match-similarity">
                        <div className="similarity-bar">
                          <div 
                            className="similarity-fill"
                            style={{ width: `${match.similarity}%` }}
                          ></div>
                        </div>
                        <span className="similarity-value">{match.similarity}% similar</span>
                      </div>
                      <div className="match-details">
                        <span className="match-placement">
                          {match.placement <= 4 ? '🥇' : match.placement <= 8 ? '🥈' : '🥉'} 
                          Placement: {match.placement}
                        </span>
                        <span className="match-tournament">{match.tournament}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem se não encontrou */}
          {result.comparison.message && (
            <div className="info-message">
              ℹ️ {result.comparison.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DeckComparison;
