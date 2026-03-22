import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './MetaDashboard.css';
import './MetaDashboard.mobile.css';
import CardImage from './components/CardImage';
import DecklistVisual from './components/DecklistVisual';
import TierListEnhanced from './components/TierListEnhanced';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export default function MetaDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [tierList, setTierList] = useState(null);
  const [trends, setTrends] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showDecklistDemo, setShowDecklistDemo] = useState(false);

  useEffect(() => {
    fetchMetaData();
    fetchTierList();
    fetchTrends();
    // eslint-disable-next-line
  }, []);

  async function fetchMetaData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/meta-analysis/dashboard?days=30`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setMetaData(data);
      
      const now = new Date();
      setLastUpdate(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    } catch (e) {
      console.error('Error fetching meta:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTierList() {
    try {
      const res = await fetch(`${API}/api/meta-analysis/tier-list`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTierList(data.tierList);
    } catch (e) {
      console.error('Error fetching tier list:', e);
    }
  }

  async function fetchTrends() {
    try {
      const res = await fetch(`${API}/api/meta-analysis/trends`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrends(data.trends);
    } catch (e) {
      console.error('Error fetching trends:', e);
    }
  }

  async function triggerScraping() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/api/meta-analysis/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`Scraping completed!\n${data.decks_scraped} decks scraped, ${data.decks_saved} saved`);
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
      setError(null);
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
        <p>{t('metaDashboard.loading')}</p>
      </div>
    );
  }

  const totalDecks = metaData?.stats?.totalDecks || 0;
  const archetypes = metaData?.archetypes || [];
  const topCards = metaData?.topCards || [];

  const exampleDeck = `4 Lore
4 Beast - Hardheaded
4 Fishbone Quill
4 A Whole New World
4 Ursula - Trickster
4 Fire the Cannons!
4 Mickey Mouse - Detective
4 Aurora - Dreaming Guardian
4 Cinderella - Ballroom Sensation
4 Elsa - Spirit of Winter
4 Sisu - Divine Water Dragon
4 Maleficent - Uninvited
4 Be Prepared
4 Steal from the Rich
4 Pawpsicle`;

  return (
    <div className="meta-dashboard">
      {/* Header */}
      <div className="meta-header">
        <div className="meta-title-section">
          <h1 className="meta-title">{t('metaDashboard.title')}</h1>
          <p className="meta-subtitle">
            {t('metaDashboard.subtitle', { count: totalDecks })}
          </p>
        </div>
        <div className="meta-header-actions">
          <button onClick={triggerScraping} className="btn-action" disabled={loading}>
            🔍 {t('metaDashboard.actions.scrape')}
          </button>
          <button onClick={triggerAnalysis} className="btn-action" disabled={loading}>
            📊 {t('metaDashboard.actions.analyze')}
          </button>
          <button onClick={() => { fetchMetaData(); fetchTierList(); fetchTrends(); }} className="btn-refresh" disabled={loading}>
            🔄 {t('metaDashboard.actions.refresh')}
          </button>
          <span className="last-update">{t('metaDashboard.lastUpdate', { time: lastUpdate })}</span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ❌ {t('metaDashboard.error')}: {error}
          <button onClick={() => { setError(null); fetchMetaData(); }}>
            {t('metaDashboard.retry')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="meta-tabs">
        {['overview', 'tierlist', 'trends', 'cards', 'demos'].map(tab => (
          <button
            key={tab}
            className={`meta-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 ' + t('metaDashboard.tabs.overview')}
            {tab === 'tierlist' && '🏆 ' + t('metaDashboard.tabs.tierlist')}
            {tab === 'trends' && '📈 ' + t('metaDashboard.tabs.trends')}
            {tab === 'cards' && '🃏 ' + t('metaDashboard.tabs.cards')}
            {tab === 'demos' && '🧪 ' + t('metaDashboard.tabs.demos')}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-number">{totalDecks}</div>
            <div className="stat-label">{t('metaDashboard.stats.totalDecks')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-number">{metaData?.stats?.uniqueArchetypes || 0}</div>
            <div className="stat-label">{t('metaDashboard.stats.archetypes')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-number">{metaData?.stats?.totalCards || 0}</div>
            <div className="stat-label">{t('metaDashboard.stats.uniqueCards')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-number">30d</div>
            <div className="stat-label">{t('metaDashboard.stats.timeRange')}</div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab archetypes={archetypes} totalDecks={totalDecks} topCards={topCards} t={t} />
      )}

      {activeTab === 'tierlist' && tierList && (
        <div className="meta-section">
          <TierListEnhanced tierList={tierList} />
        </div>
      )}

      {activeTab === 'trends' && (
        <TrendsTab trends={trends} t={t} />
      )}

      {activeTab === 'cards' && (
        <CardsTab cards={topCards} totalDecks={totalDecks} t={t} />
      )}

      {activeTab === 'demos' && (
        <DemoTab exampleDeck={exampleDeck} showDecklist={showDecklistDemo} setShowDecklist={setShowDecklistDemo} t={t} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function DemoTab({ exampleDeck, showDecklist, setShowDecklist, t }) {
  return (
    <div style={{ padding: '20px' }}>
      {/* Lorcast API Test */}
      <div className="meta-section" style={{ 
        marginBottom: '40px',
        padding: '30px', 
        background: 'rgba(103, 126, 234, 0.1)', 
        borderRadius: '12px', 
        border: '2px solid #667eea' 
      }}>
        <div className="section-header">
          <span className="section-icon">🧪</span>
          <span className="section-title">{t('metaDashboard.sections.lorcastTest')}</span>
          <span className="section-badge" style={{ background: '#667eea', color: 'white', padding: '4px 12px', borderRadius: '4px' }}>
            {t('metaDashboard.labels.live')}
          </span>
        </div>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
          marginTop: '30px',
          padding: '20px'
        }}>
          <CardImage cardName="Elsa - Spirit of Winter" size="normal" />
          <CardImage cardName="Mickey Mouse - Brave Little Tailor" size="small" />
          <CardImage cardName="Sisu - Divine Water Dragon" size="small" />
          <CardImage cardName="Aurora - Dreaming Guardian" size="small" />
          <CardImage cardName="Maleficent - Uninvited" size="small" />
          <CardImage cardName="Cinderella - Ballroom Sensation" size="small" />
          <CardImage cardName="Beast - Hardheaded" size="small" />
          <CardImage cardName="Ursula - Trickster" size="small" />
        </div>
      </div>
      
      {/* DecklistVisual Demo */}
      <div className="meta-section">
        <div className="section-header" style={{ marginBottom: '20px' }}>
          <span className="section-icon">🎴</span>
          <span className="section-title">{t('metaDashboard.sections.decklistDemo')}</span>
          <button 
            onClick={() => setShowDecklist(!showDecklist)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: showDecklist ? '#e74c3c' : '#667eea',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {showDecklist ? `✕ ${t('metaDashboard.labels.hide')}` : `▶ ${t('metaDashboard.labels.showDemo')}`}
          </button>
        </div>
        
        {showDecklist && (
          <DecklistVisual 
            deckText={exampleDeck}
            title="Exemplo: Evasivo Amethyst/Emerald"
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ archetypes, totalDecks, topCards, t }) {
  return (
    <div className="overview-tab">
      <div className="meta-section">
        <div className="section-header">
          <span className="section-icon">🎯</span>
          <span className="section-title">{t('metaDashboard.sections.archetypeBreakdown')}</span>
          <span className="section-badge">{archetypes.length} {t('metaDashboard.labels.total')}</span>
        </div>

        <div className="archetype-breakdown">
          {archetypes.map((archetype, i) => {
            const percentage = totalDecks > 0
              ? ((archetype.deck_count / totalDecks) * 100).toFixed(1)
              : '0.0';
              
            const winRate = archetype.win_rate != null
              ? parseFloat(archetype.win_rate).toFixed(1) 
              : '0.0';

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
                  <span className="stat-decks">{archetype.deck_count || 0} {t('metaDashboard.labels.decks')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="meta-section">
        <div className="section-header">
          <span className="section-icon">🃏</span>
          <span className="section-title">{t('metaDashboard.sections.topCards')}</span>
          <span className="section-badge">{t('metaDashboard.labels.preview')}</span>
        </div>

        <div className="card-grid-small">
          {topCards.slice(0, 6).map((card, i) => {
            const percentage = card.meta_share != null
              ? parseFloat(card.meta_share).toFixed(1)
              : '0.0';

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

function TrendsTab({ trends, t }) {
  if (!trends) {
    return <div className="empty-state">{t('common.loading')}...</div>;
  }

  return (
    <div className="trends-container">
      <div className="trends-section">
        <div className="section-header">
          <span className="section-icon">📈</span>
          <span className="section-title">{t('metaDashboard.sections.rising')}</span>
          <span className="section-badge success">{trends.rising?.length || 0}</span>
        </div>

        <div className="trends-list">
          {trends.rising?.slice(0, 10).map((trend, i) => (
            <div key={i} className="trend-item rising">
              <span className="trend-archetype">{trend.archetype}</span>
              <span className="trend-delta">+{trend.trend_delta}%</span>
              <span className="trend-share">
                {trend.meta_share != null ? trend.meta_share.toFixed(1) : '0.0'}% {t('metaDashboard.labels.share')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="trends-section">
        <div className="section-header">
          <span className="section-icon">📉</span>
          <span className="section-title">{t('metaDashboard.sections.falling')}</span>
          <span className="section-badge error">{trends.falling?.length || 0}</span>
        </div>

        <div className="trends-list">
          {trends.falling?.slice(0, 10).map((trend, i) => (
            <div key={i} className="trend-item falling">
              <span className="trend-archetype">{trend.archetype}</span>
              <span className="trend-delta">{trend.trend_delta}%</span>
              <span className="trend-share">
                {trend.meta_share != null ? trend.meta_share.toFixed(1) : '0.0'}% {t('metaDashboard.labels.share')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardsTab({ cards, totalDecks, t }) {
  return (
    <div className="cards-grid-full">
      {cards.map((card, i) => {
        const percentage = card.meta_share != null
          ? parseFloat(card.meta_share).toFixed(1)
          : '0.0';

        return (
          <div key={i} className="card-item-full">
            <div className="card-rank-large">#{i + 1}</div>
            <div className="card-info-full">
              <div className="card-name-large">{card.card_name}</div>
              <div className="card-stats-full">
                <div className="card-stat">
                  <span className="card-stat-label">{t('metaDashboard.labels.metaShare')}</span>
                  <span className="card-stat-value">{percentage}%</span>
                </div>
                <div className="card-stat">
                  <span className="card-stat-label">{t('metaDashboard.labels.decks')}</span>
                  <span className="card-stat-value">{card.deck_count || 0}</span>
                </div>
                <div className="card-stat">
                  <span className="card-stat-label">{t('metaDashboard.labels.avgCopies')}</span>
                  <span className="card-stat-value">{card.avg_copies || 0}</span>
                </div>
                {card.win_rate > 0 && (
                  <div className="card-stat">
                    <span className="card-stat-label">{t('metaDashboard.labels.winRate')}</span>
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
