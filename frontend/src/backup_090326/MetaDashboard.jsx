import React, { useEffect, useState } from 'react';
import './MetaDashboard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * MetaDashboard - Enhanced with Tier List and Win Rate Tracking
 */
export default function MetaDashboard() {
  const [loading, setLoading] = useState(true);
  const [metaData, setMetaData] = useState(null);
  const [tierList, setTierList] = useState(null);
  const [trends, setTrends] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, tierlist, trends, cards

  useEffect(() => {
    fetchMetaData();
    fetchTierList();
    fetchTrends();
  }, []);

  async function fetchMetaData() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/meta-analysis/dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json();
      setMetaData(data);
      
      const now = new Date();
      setLastUpdate(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    } catch (e) {
      console.error('Error fetching meta:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTierList() {
    try {
      const res = await fetch(`${API}/api/meta-analysis/tier-list`);
      const data = await res.json();
      setTierList(data.tierList);
    } catch (e) {
      console.error('Error fetching tier list:', e);
    }
  }

  async function fetchTrends() {
    try {
      const res = await fetch(`${API}/api/meta-analysis/trends`);
      const data = await res.json();
      setTrends(data.trends);
    } catch (e) {
      console.error('Error fetching trends:', e);
    }
  }

  async function triggerScraping() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/meta-analysis/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`Scraping completed!\n${data.tournaments} tournaments, ${data.decks} decks`);
        fetchMetaData();
        fetchTierList();
      }
    } catch (e) {
      console.error('Error triggering scraping:', e);
      alert('Failed to trigger scraping');
    } finally {
      setLoading(false);
    }
  }

  async function triggerAnalysis() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/meta-analysis/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        alert('Analysis completed!');
        fetchMetaData();
        fetchTierList();
        fetchTrends();
      }
    } catch (e) {
      console.error('Error triggering analysis:', e);
      alert('Failed to trigger analysis');
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

  const totalDecks = metaData?.stats?.totalDecks || 0;
  const archetypes = metaData?.archetypes || [];
  const topCards = metaData?.topCards || [];

  return (
    <div className="meta-dashboard">
      {/* Header */}
      <div className="meta-header">
        <div className="meta-title-section">
          <h1 className="meta-title">Meta Analysis</h1>
          <p className="meta-subtitle">
            Real-time tournament data • {totalDecks} decks analyzed • Last 30 days
          </p>
        </div>
        <div className="meta-header-actions">
          <button onClick={triggerScraping} className="btn-action" disabled={loading}>
            🔍 Scrape Now
          </button>
          <button onClick={triggerAnalysis} className="btn-action" disabled={loading}>
            📊 Analyze
          </button>
          <button onClick={() => { fetchMetaData(); fetchTierList(); fetchTrends(); }} className="btn-refresh" disabled={loading}>
            🔄 Refresh
          </button>
          <span className="last-update">Updated {lastUpdate}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="meta-tabs">
        {['overview', 'tierlist', 'trends', 'cards'].map(tab => (
          <button
            key={tab}
            className={`meta-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'tierlist' && '🏆 Tier List'}
            {tab === 'trends' && '📈 Trends'}
            {tab === 'cards' && '🃏 Cards'}
          </button>
        ))}
      </div>

      {/* Stats Cards (Always visible) */}
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
            <div className="stat-number">{metaData?.stats?.uniqueArchetypes || 0}</div>
            <div className="stat-label">Archetypes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-number">{(metaData?.stats?.avgWinRate || 50).toFixed(1)}%</div>
            <div className="stat-label">Avg Win Rate</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-number">{(metaData?.stats?.topDeckShare || 0).toFixed(1)}%</div>
            <div className="stat-label">Top Deck Share</div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab archetypes={archetypes} totalDecks={totalDecks} topCards={topCards} />
      )}

      {activeTab === 'tierlist' && (
        <TierListTab tierList={tierList} />
      )}

      {activeTab === 'trends' && (
        <TrendsTab trends={trends} />
      )}

      {activeTab === 'cards' && (
        <CardsTab cards={topCards} totalDecks={totalDecks} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════

function OverviewTab({ archetypes, totalDecks, topCards }) {
  return (
    <div className="meta-content">
      {/* Meta Breakdown */}
      <div className="meta-section meta-breakdown">
        <div className="section-header">
          <span className="section-icon">🔮</span>
          <span className="section-title">Meta Breakdown</span>
          <span className="section-badge">{archetypes.length} archetypes</span>
        </div>

        <div className="breakdown-list">
          {archetypes.slice(0, 10).map((archetype, i) => {
            const percentage = ((archetype.total_decks / totalDecks) * 100).toFixed(1);
            const winRate = archetype.win_rate?.toFixed(1) || 0;

            return (
              <div key={i} className="breakdown-item">
                <div className="breakdown-rank">#{i + 1}</div>
                <div className="breakdown-info">
                  <span className="breakdown-name">{archetype.archetype}</span>
                  <span className="breakdown-inks">
                    {archetype.inks?.join(' / ') || 'Unknown'}
                  </span>
                </div>
                
                <div className="breakdown-bar-container">
                  <div 
                    className="breakdown-bar" 
                    style={{ 
                      width: `${Math.min(100, parseFloat(percentage) * 5)}%`,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                    }}
                  >
                    <span className="breakdown-percentage">{percentage}%</span>
                  </div>
                </div>

                <div className="breakdown-stats">
                  <span className="stat-wr">WR: {winRate}%</span>
                  <span className="stat-decks">{archetype.total_decks} decks</span>
                  {archetype.top8_count > 0 && (
                    <span className="stat-top8">{archetype.top8_count} Top 8</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Cards Preview */}
      <div className="meta-section">
        <div className="section-header">
          <span className="section-icon">🃏</span>
          <span className="section-title">Top Cards</span>
          <span className="section-badge">Preview</span>
        </div>

        <div className="card-grid-small">
          {topCards.slice(0, 6).map((card, i) => {
            const percentage = ((card.total_decks / totalDecks) * 100).toFixed(1);

            return (
              <div key={i} className="card-item-small">
                <div className="card-rank">#{i + 1}</div>
                <div className="card-name">{card.card_name}</div>
                <div className="card-percentage">{percentage}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TIER LIST TAB
// ═══════════════════════════════════════════════════════════

function TierListTab({ tierList }) {
  if (!tierList) {
    return <div className="empty-state">Loading tier list...</div>;
  }

  const tierColors = {
    S: '#ff4757',
    A: '#ffa502',
    B: '#eccc68',
    C: '#70a1ff',
    D: '#a4b0be'
  };

  return (
    <div className="tier-list-container">
      {['S', 'A', 'B', 'C', 'D'].map(tier => {
        const archetypes = tierList[tier] || [];
        if (archetypes.length === 0) return null;

        return (
          <div key={tier} className="tier-section">
            <div className="tier-header" style={{ background: tierColors[tier] }}>
              <span className="tier-label">TIER {tier}</span>
              <span className="tier-count">{archetypes.length} archetypes</span>
            </div>

            <div className="tier-archetypes">
              {archetypes.map((archetype, i) => (
                <div key={i} className="tier-archetype-card">
                  <div className="tier-archetype-header">
                    <span className="tier-archetype-name">{archetype.archetype}</span>
                    <span className="tier-power-level">{archetype.power_level}/100</span>
                  </div>
                  
                  <div className="tier-archetype-stats">
                    <div className="tier-stat">
                      <span className="tier-stat-label">Win Rate</span>
                      <span className="tier-stat-value">{archetype.win_rate?.toFixed(1)}%</span>
                    </div>
                    <div className="tier-stat">
                      <span className="tier-stat-label">Meta Share</span>
                      <span className="tier-stat-value">{archetype.meta_share?.toFixed(1)}%</span>
                    </div>
                  </div>

                  {archetype.inks && (
                    <div className="tier-archetype-inks">
                      {archetype.inks.map((ink, j) => (
                        <span key={j} className={`ink-badge ink-${ink.toLowerCase()}`}>
                          {ink}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TRENDS TAB
// ═══════════════════════════════════════════════════════════

function TrendsTab({ trends }) {
  if (!trends) {
    return <div className="empty-state">Loading trends...</div>;
  }

  return (
    <div className="trends-container">
      <div className="trends-section">
        <div className="section-header">
          <span className="section-icon">📈</span>
          <span className="section-title">Rising</span>
          <span className="section-badge success">{trends.rising?.length || 0}</span>
        </div>

        <div className="trends-list">
          {trends.rising?.slice(0, 10).map((trend, i) => (
            <div key={i} className="trend-item rising">
              <span className="trend-archetype">{trend.archetype}</span>
              <span className="trend-delta">+{trend.trend_delta}%</span>
              <span className="trend-share">{trend.meta_share?.toFixed(1)}% share</span>
            </div>
          ))}
        </div>
      </div>

      <div className="trends-section">
        <div className="section-header">
          <span className="section-icon">📉</span>
          <span className="section-title">Falling</span>
          <span className="section-badge error">{trends.falling?.length || 0}</span>
        </div>

        <div className="trends-list">
          {trends.falling?.slice(0, 10).map((trend, i) => (
            <div key={i} className="trend-item falling">
              <span className="trend-archetype">{trend.archetype}</span>
              <span className="trend-delta">{trend.trend_delta}%</span>
              <span className="trend-share">{trend.meta_share?.toFixed(1)}% share</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CARDS TAB
// ═══════════════════════════════════════════════════════════

function CardsTab({ cards, totalDecks }) {
  return (
    <div className="cards-grid-full">
      {cards.map((card, i) => {
        const percentage = ((card.total_decks / totalDecks) * 100).toFixed(1);

        return (
          <div key={i} className="card-item-full">
            <div className="card-rank-large">#{i + 1}</div>
            <div className="card-info-full">
              <div className="card-name-large">{card.card_name}</div>
              <div className="card-stats-full">
                <div className="card-stat">
                  <span className="card-stat-label">Meta Share</span>
                  <span className="card-stat-value">{percentage}%</span>
                </div>
                <div className="card-stat">
                  <span className="card-stat-label">Decks</span>
                  <span className="card-stat-value">{card.total_decks}</span>
                </div>
                <div className="card-stat">
                  <span className="card-stat-label">Avg Copies</span>
                  <span className="card-stat-value">{card.avg_copies}</span>
                </div>
                {card.win_rate > 0 && (
                  <div className="card-stat">
                    <span className="card-stat-label">Win Rate</span>
                    <span className="card-stat-value">{card.win_rate}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
