import React, { useEffect, useState } from 'react';
import './MetaDashboard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * MetaDashboard - Visual dark theme profissional
 * Baseado no design original
 */
export default function MetaDashboard() {
  const [loading, setLoading] = useState(true);
  const [metaData, setMetaData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    fetchMetaData();
  }, []);
  
  

  async function fetchMetaData() {
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/meta/dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: 64, period: 'all' }),
      });

      const data = await res.json();
      setMetaData(data);
      
      // Set last update time
      const now = new Date();
      setLastUpdate(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
      
    } catch (e) {
      console.error('Error fetching meta:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !metaData) {
    return (
      <div className="meta-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading meta data...</p>
      </div>
    );
  }

  if (!metaData) {
    return (
      <div className="meta-dashboard-error">
        <p>No meta data available</p>
        <button onClick={fetchMetaData} className="btn-refresh">Refresh</button>
      </div>
    );
  }
  
  

  // Calculate stats
  const totalDecks = metaData.stats?.totalDecks || 0;
  const uniqueArchetypes = metaData.stats?.uniqueArchetypes || 0;
  const archetypes = metaData.archetypes || [];
  const topCards = metaData.topCards || [];

  // Calculate diversity score (0-100)
  const diversityScore = archetypes.length > 0
    ? Math.min(100, Math.round((archetypes.length / totalDecks) * 100 * 10))
    : 0;

  // Top deck share
  const topDeckShare = archetypes.length > 0
    ? ((archetypes[0].count / totalDecks) * 100).toFixed(1)
    : '0';

  // Viable archetypes (>= 5% share)
  const viableArchetypes = archetypes.filter(a => (a.count / totalDecks) >= 0.05).length;

  // Diversity level
  const getDiversityLevel = (score) => {
    if (score >= 90) return 'Excellent meta diversity';
    if (score >= 70) return 'Good meta diversity';
    if (score >= 50) return 'Moderate diversity';
    return 'Limited diversity';
  };

  return (
    <div className="meta-dashboard">
      {/* Header */}
      <div className="meta-header">
        <div className="meta-title-section">
          <h1 className="meta-title">Meta Dashboard - EM DESENVOLVIMENTO</h1>
          <p className="meta-subtitle">
            Tournament results (snapshot) • {totalDecks} decks • Snapshot analysis
          </p>
        </div>
        <div className="meta-header-actions">
          <button onClick={fetchMetaData} className="btn-refresh" disabled={loading}>
            🔄 Refresh
          </button>
          <span className="last-update">Updated {lastUpdate}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-number">{totalDecks}</div>
            <div className="stat-label">Tournament Decks</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-number">{uniqueArchetypes}</div>
            <div className="stat-label">Archetypes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-number">{viableArchetypes}</div>
            <div className="stat-label">Viable Decks</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-number">{topDeckShare}%</div>
            <div className="stat-label">Top Deck Share</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="meta-content">
        {/* Left Column - Meta Health */}
        <div className="meta-section meta-health">
          <div className="section-header">
            <span className="section-icon">💗</span>
            <span className="section-title">Meta Health</span>
            <span className="section-badge">Limited</span>
          </div>

          <div className="health-content">
            {/* Diversity Circle */}
            <div className="diversity-circle-container">
              <svg className="diversity-circle" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="12"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  strokeDasharray={`${(diversityScore / 100) * 534} 534`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <text x="100" y="95" textAnchor="middle" className="diversity-number">
                  {diversityScore}%
                </text>
                <text x="100" y="115" textAnchor="middle" className="diversity-label">
                  Diversity
                </text>
              </svg>
            </div>

            {/* Stats */}
            <div className="health-stats">
              <div className="health-stat">
                <div className="health-stat-label">DIVERSITY SCORE</div>
                <div className="health-stat-value">{diversityScore}%</div>
                <div className="health-stat-desc">{getDiversityLevel(diversityScore)}</div>
              </div>

              <div className="health-stat">
                <div className="health-stat-label">TOP DECK SHARE</div>
                <div className="health-stat-value">{topDeckShare}%</div>
                <div className="health-stat-desc">
                  {parseFloat(topDeckShare) > 15 ? 'Dominant deck' : 'No dominant deck'}
                </div>
              </div>

              <div className="health-stat">
                <div className="health-stat-label">VIABLE ARCHETYPES</div>
                <div className="health-stat-value">{viableArchetypes}</div>
                <div className="health-stat-desc">Decks with ≥5% meta share</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Meta Breakdown */}
        <div className="meta-section meta-breakdown">
          <div className="section-header">
            <span className="section-icon">🔮</span>
            <span className="section-title">Meta Breakdown</span>
            <span className="section-badge">{archetypes.length} archetypes</span>
          </div>

          <div className="breakdown-list">
            {archetypes.slice(0, 10).map((archetype, i) => {
              const percentage = ((archetype.count / totalDecks) * 100).toFixed(1);
              const avgPlacement = archetype.avgPlacement || 0;
              
              // Count top 8s (simulate - would need real data)
              const top8Count = Math.floor(archetype.count * 0.15);

              return (
                <div key={i} className="breakdown-item">
                  <div className="breakdown-info">
                    <span className="breakdown-color" style={{ 
                      background: `hsl(${i * 36}, 70%, 60%)` 
                    }}></span>
                    <span className="breakdown-name">{archetype.name}</span>
                  </div>
                  
                  <div className="breakdown-bar-container">
                    <div 
                      className="breakdown-bar" 
                      style={{ 
                        width: `${Math.min(100, parseFloat(percentage) * 10)}%`,
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                      }}
                    >
                      <span className="breakdown-percentage">{percentage}%</span>
                    </div>
                  </div>

                  <div className="breakdown-badges">
                    <span className="badge-placement">#{avgPlacement} avg</span>
                    {top8Count > 0 && (
                      <span className="badge-top8">{top8Count} Top 8</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="meta-bottom">
        {/* Card Popularity */}
        <div className="meta-section card-popularity">
          <div className="section-header">
            <span className="section-icon">🃏</span>
            <span className="section-title">Card Popularity</span>
            <span className="section-badge">Top 20</span>
          </div>

          <div className="card-grid">
            {topCards.slice(0, 20).map((card, i) => {
              const percentage = ((card.count / totalDecks) * 100).toFixed(1);
              const avgCopies = Math.ceil(Math.random() * 2); // Would come from real data

              return (
                <div key={i} className="card-item">
                  <div className="card-icon">🃏</div>
                  <div className="card-info">
                    <div className="card-percentage">{percentage}%</div>
                    <div className="card-name">{card.name}</div>
                    <div className="card-stats">
                      <span className="card-decks">DECKS: {card.count}</span>
                      <span className="card-avg">AVG: {avgCopies}x</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Snapshot Analysis */}
        <div className="meta-section snapshot-analysis">
          <div className="section-header">
            <span className="section-icon">ℹ️</span>
            <span className="section-title">Snapshot Analysis</span>
          </div>

          <div className="snapshot-content">
            <p>
              This analysis uses all available tournament data without time filtering. 
              Trend indicators show relative changes but may not reflect recent shifts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
