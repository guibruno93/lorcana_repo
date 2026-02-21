import React, { useState, useEffect } from 'react';
import './MatchupTable.css';

/**
 * MatchupTable Component
 * Mostra matchups do deck contra arquétipos do meta
 */
export default function MatchupTable({ decklist }) {
  const [loading, setLoading] = useState(false);
  const [matchups, setMatchups] = useState(null);
  const [error, setError] = useState('');
  const [expandedMatchup, setExpandedMatchup] = useState(null);

  useEffect(() => {
    if (decklist && decklist.trim()) {
      analyzeMatchups();
    }
  }, [decklist]);

  const analyzeMatchups = async () => {
    if (!decklist || !decklist.trim()) {
      setError('Decklist is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/ai/matchups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist }),
      });

      if (!res.ok) {
        throw new Error(`Matchup analysis failed: ${res.statusText}`);
      }

      const data = await res.json();
      setMatchups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMatchup = (index) => {
    setExpandedMatchup(expandedMatchup === index ? null : index);
  };

  const getRatingColor = (rating) => {
    switch (rating) {
      case 'Favored': return '#10B981';
      case 'Even': return '#F59E0B';
      case 'Unfavored': return '#EF4444';
      case 'Very Unfavored': return '#DC2626';
      default: return '#94A3B8';
    }
  };

  const getRatingIcon = (rating) => {
    switch (rating) {
      case 'Favored': return '😀';
      case 'Even': return '😐';
      case 'Unfavored': return '😕';
      case 'Very Unfavored': return '😭';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="matchup-table loading">
        <div className="loading-spinner">⏳ Analyzing matchups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matchup-table error">
        <div className="error-message">❌ {error}</div>
        <button onClick={analyzeMatchups} className="btn-primary">
          🔄 Retry
        </button>
      </div>
    );
  }

  if (!matchups || !matchups.available) {
    return (
      <div className="matchup-table unavailable">
        <div className="info-message">
          ℹ️ {matchups?.note || 'Matchup data not available'}
        </div>
      </div>
    );
  }

  return (
    <div className="matchup-table">
      {/* Header */}
      <div className="matchup-header">
        <h3>⚔️ Matchup Analysis</h3>
        <p className="subtitle">Your deck: <strong>{matchups.deckArchetype}</strong></p>
      </div>

      {/* Meta Position */}
      {matchups.metaPosition && (
        <div className="meta-position">
          <div className="tier-badge" style={{
            background: matchups.metaPosition.tier === 'Tier 1' ? 
              'linear-gradient(135deg, #10B981 0%, #059669 100%)' :
              matchups.metaPosition.tier === 'Tier 2' ?
              'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' :
              'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
          }}>
            {matchups.metaPosition.tier}
          </div>
          <div className="tier-info">
            <div className="tier-description">{matchups.metaPosition.description}</div>
            <div className="tier-stats">
              <span>Avg Win Rate: {matchups.metaPosition.avgWinRate}%</span>
              <span>Favorable Meta: {matchups.metaPosition.favorableMetaShare}%</span>
              <span>Unfavorable Meta: {matchups.metaPosition.unfavorableMetaShare}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Overall Stats */}
      {matchups.stats && (
        <div className="overall-stats">
          <div className="stat-box">
            <div className="stat-value">{matchups.stats.avgWinRate}%</div>
            <div className="stat-label">Avg Win Rate</div>
          </div>
          <div className="stat-box">
            <div className="stat-value green">{matchups.stats.favoredCount}</div>
            <div className="stat-label">Favored</div>
          </div>
          <div className="stat-box">
            <div className="stat-value yellow">{matchups.stats.evenCount}</div>
            <div className="stat-label">Even</div>
          </div>
          <div className="stat-box">
            <div className="stat-value red">{matchups.stats.unfavoredCount}</div>
            <div className="stat-label">Unfavored</div>
          </div>
        </div>
      )}

      {/* Matchups Table */}
      <div className="matchups-list">
        {matchups.matchups.map((matchup, index) => (
          <div 
            key={index} 
            className={`matchup-row ${expandedMatchup === index ? 'expanded' : ''}`}
          >
            {/* Summary */}
            <div className="matchup-summary" onClick={() => toggleMatchup(index)}>
              <div className="matchup-opponent">
                <span className="rating-icon">{getRatingIcon(matchup.rating)}</span>
                <span className="opponent-name">{matchup.opponent}</span>
                <span className="meta-share">{matchup.metaShare}% meta</span>
              </div>
              <div className="matchup-stats">
                <div className="win-rate" style={{ color: getRatingColor(matchup.rating) }}>
                  {matchup.winRate}%
                </div>
                <div className="rating-badge" style={{ 
                  background: `${getRatingColor(matchup.rating)}20`,
                  color: getRatingColor(matchup.rating)
                }}>
                  {matchup.rating}
                </div>
                <div className="expand-icon">
                  {expandedMatchup === index ? '▲' : '▼'}
                </div>
              </div>
            </div>

            {/* Details (Expanded) */}
            {expandedMatchup === index && (
              <div className="matchup-details">
                {/* Factors */}
                <div className="factors-grid">
                  <div className="factor">
                    <div className="factor-label">Speed</div>
                    <div className={`factor-value ${matchup.factors.speedAdvantage > 0 ? 'positive' : matchup.factors.speedAdvantage < 0 ? 'negative' : 'neutral'}`}>
                      {matchup.factors.speedAdvantage > 0 ? '+' : ''}{matchup.factors.speedAdvantage}
                    </div>
                  </div>
                  <div className="factor">
                    <div className="factor-label">Removal</div>
                    <div className={`factor-value ${matchup.factors.removalAdvantage > 0 ? 'positive' : matchup.factors.removalAdvantage < 0 ? 'negative' : 'neutral'}`}>
                      {matchup.factors.removalAdvantage > 0 ? '+' : ''}{matchup.factors.removalAdvantage}
                    </div>
                  </div>
                  <div className="factor">
                    <div className="factor-label">Lore</div>
                    <div className={`factor-value ${matchup.factors.loreAdvantage > 0 ? 'positive' : matchup.factors.loreAdvantage < 0 ? 'negative' : 'neutral'}`}>
                      {matchup.factors.loreAdvantage > 0 ? '+' : ''}{matchup.factors.loreAdvantage}
                    </div>
                  </div>
                  <div className="factor">
                    <div className="factor-label">Synergy</div>
                    <div className={`factor-value ${matchup.factors.synergyAdvantage > 0 ? 'positive' : matchup.factors.synergyAdvantage < 0 ? 'negative' : 'neutral'}`}>
                      {matchup.factors.synergyAdvantage > 0 ? '+' : ''}{matchup.factors.synergyAdvantage}
                    </div>
                  </div>
                  <div className="factor">
                    <div className="factor-label">Confidence</div>
                    <div className="factor-value">
                      {Math.round(matchup.confidence * 100)}%
                    </div>
                  </div>
                </div>

                {/* Insights */}
                {matchup.insights && matchup.insights.length > 0 && (
                  <div className="insights">
                    <h5>💡 Key Insights</h5>
                    <div className="insights-list">
                      {matchup.insights.map((insight, i) => (
                        <div key={i} className={`insight-item ${insight.type}`}>
                          <div className="insight-category">{insight.category}</div>
                          <div className="insight-text">{insight.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {matchup.avgFinish && (
                  <div className="additional-info">
                    <span>Opponent avg finish: <strong>#{matchup.avgFinish}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="matchup-legend">
        <h5>Legend:</h5>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#10B981' }} />
            <span>Favored (≥65% WR)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#F59E0B' }} />
            <span>Even (45-65% WR)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#EF4444' }} />
            <span>Unfavored (35-45% WR)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: '#DC2626' }} />
            <span>Very Unfavored (&lt;35% WR)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
