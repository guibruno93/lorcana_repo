import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './MetaDashboard.css';
import './MetaDashboard.mobile.css';
import ScrapedMetaDashboard from './components/MetaDashboard';
import { ArchetypeWithIcons } from './components/InkIcons';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export default function MetaDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchMetaData();
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
      console.log('📊 Dashboard data received:', data);
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

  async function triggerScraping() {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        alert(t('metaDashboard.scrapeLoginRequired', 'Faça login para executar o scraper.'));
        navigate('/login');
        return;
      }
      const res = await fetch(`${API}/api/meta-analysis/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: 10 }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      let total = 0;
      const logs = [];
      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          if (evt.type === 'log' && evt.message) logs.push(evt.message);
          if (evt.type === 'complete') total = evt.total ?? total;
        } catch (_) {
          /* linha inválida */
        }
      }
      alert(
        `${t('metaDashboard.scrapeDone', 'Scraping concluído.')}\n` +
          `${t('metaDashboard.scrapeDecks', 'Decks')}: ${total}\n\n` +
          logs.slice(-8).join('\n')
      );
      fetchMetaData();
    } catch (e) {
      console.error('Error triggering scraping:', e);
      alert(
        t('metaDashboard.scrapeFailed', 'Falha ao executar scraping') + `: ${e.message}`
      );
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

  // ✅ CORRIGIDO: Usar campos corretos do JSON
  const totalDecks = metaData?.stats?.totalDecks || 0;
  const archetypes = metaData?.topArchetypes || metaData?.allArchetypes || [];
  const totalArchetypes = metaData?.stats?.totalArchetypes || 0;
  const topCards = []; // Backend não retorna topCards ainda

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
          <button onClick={() => fetchMetaData()} className="btn-refresh" disabled={loading}>
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
        {['overview', 'meta-analysis', 'cards'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`meta-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 ' + t('metaDashboard.tabs.overview')}
            {tab === 'meta-analysis' &&
              '📈 ' + t('metaDashboard.tabs.metaAnalysis')}
            {tab === 'cards' && '🃏 ' + t('metaDashboard.tabs.cards')}
          </button>
        ))}
        <button
          type="button"
          className="meta-tab meta-tab-link"
          onClick={() => navigate('/meta/tier-lists')}
        >
          📋 {t('metaDashboard.tabs.tierLists', 'Tier lists')}
        </button>
      </div>

      {/* Stats Cards — só na visão geral (evita duplicar com Análise do Meta) */}
      {activeTab === 'overview' && (
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
            <div className="stat-number">{totalArchetypes}</div>
            <div className="stat-label">{t('metaDashboard.stats.archetypes')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-number">0</div>
            <div className="stat-label">{t('metaDashboard.stats.uniqueCards')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-number">30d</div>
            <div className="stat-label">{t('metaDashboard.stats.timeRange')}</div>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          archetypes={archetypes}
          totalDecks={totalDecks}
          topCards={topCards}
          t={t}
        />
      )}

      {activeTab === 'meta-analysis' && (
        <div className="meta-embedded-scraped">
          <ScrapedMetaDashboard embedded />
        </div>
      )}

      {activeTab === 'cards' && (
        <CardsTab cards={topCards} totalDecks={totalDecks} t={t} />
      )}
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
            // ✅ CORRIGIDO: Usar campos corretos do JSON
            const playRate = archetype.playRate || archetype.play_rate || '0.0';
            const winRate = archetype.winrate || archetype.expected_winrate || '0.0';
            const sampleSize = archetype.sampleSize || archetype.sample_size || 0;

            return (
              <div key={i} className="breakdown-item">
                <div className="breakdown-rank">#{i + 1}</div>
                <div className="breakdown-info">
                  <span className="breakdown-name">
                    <ArchetypeWithIcons archetype={archetype.archetype} />
                  </span>
                  <span className="breakdown-inks">
                    {archetype.inks?.join(' / ') || archetype.archetype}
                  </span>
                </div>
                
                <div className="breakdown-bar-container">
                  <div 
                    className="breakdown-bar" 
                    style={{ 
                      width: `${Math.min(100, parseFloat(playRate) * 5)}%`,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                    }}
                  >
                    <span className="breakdown-percentage">{playRate}%</span>
                  </div>
                </div>

                <div className="breakdown-stats">
                  <span className="stat-wr">WR: {winRate}%</span>
                  <span className="stat-decks">{sampleSize} {t('metaDashboard.labels.decks')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {topCards.length > 0 && (
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
      )}
    </div>
  );
}

function CardsTab({ cards, totalDecks, t }) {
  if (cards.length === 0) {
    return (
      <div className="empty-state">
        <p>Top cards data coming soon!</p>
      </div>
    );
  }

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
