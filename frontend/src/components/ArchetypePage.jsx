import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './ArchetypePage.css';
import ArchetypeOverview from './ArchetypeOverview';
import CoreCardsList from './CoreCardsList';
import MatchupsTable from './MatchupsTable';
import MetaEvolutionChart from './MetaEvolutionChart';
import DecklistViewer from './DecklistViewer';
import { ARCHETYPES } from '../data/archetypes';

export default function ArchetypePage() {
  const { archetypeId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [archetype, setArchetype] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular API call - substituir por fetch real depois
    const loadArchetype = async () => {
      setLoading(true);
      try {
        // Simular delay de API
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const data = ARCHETYPES[archetypeId];
        if (!data) {
          throw new Error('Archetype not found');
        }
        
        setArchetype(data);
      } catch (err) {
        console.error('Error loading archetype:', err);
        navigate('/meta');
      } finally {
        setLoading(false);
      }
    };

    loadArchetype();
  }, [archetypeId, navigate]);

  if (loading) {
    return (
      <div className="archetype-loading">
        <div className="spinner"></div>
        <p>{t('archetypePage.loading')}</p>
      </div>
    );
  }

  if (!archetype) {
    return (
      <div className="archetype-error">
        <h2>{t('archetypePage.notFound')}</h2>
        <button onClick={() => navigate('/meta')} className="btn btn-primary">
          {t('archetypePage.backToMeta')}
        </button>
      </div>
    );
  }

  return (
    <div className="archetype-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button onClick={() => navigate('/meta')} className="breadcrumb-link">
          {t('archetypePage.metaDashboard')}
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{archetype.name}</span>
      </div>

      {/* Overview */}
      <ArchetypeOverview archetype={archetype} />

      {/* Tabs de conteúdo */}
      <div className="archetype-content">
        {/* Core Cards */}
        <section className="archetype-section">
          <h2 className="section-title">
            <span className="section-icon section-icon--accent" aria-hidden="true" />
            {t('archetypePage.coreCards')}
          </h2>
          <CoreCardsList cards={archetype.coreCards} />
        </section>

        {/* Matchups */}
        <section className="archetype-section">
          <h2 className="section-title">
            <span className="section-icon section-icon--accent" aria-hidden="true" />
            {t('archetypePage.matchups')}
          </h2>
          <MatchupsTable matchups={archetype.matchups} />
        </section>

        {/* Meta Evolution */}
        <section className="archetype-section">
          <h2 className="section-title">
            <span className="section-icon section-icon--accent" aria-hidden="true" />
            {t('archetypePage.metaEvolution')}
          </h2>
          <MetaEvolutionChart evolution={archetype.metaEvolution} />
        </section>

        {/* Strengths & Weaknesses */}
        <div className="two-column-section">
          <section className="archetype-section">
            <h2 className="section-title">
              <span className="section-icon section-icon--accent" aria-hidden="true" />
              {t('archetypePage.strengths')}
            </h2>
            <ul className="strength-list">
              {archetype.strengths[t('language.current')].map((strength, i) => (
                <li key={i} className="strength-item">
                  <span className="strength-bullet">✓</span>
                  {strength}
                </li>
              ))}
            </ul>
          </section>

          <section className="archetype-section">
            <h2 className="section-title">
              <span className="section-icon section-icon--accent" aria-hidden="true" />
              {t('archetypePage.weaknesses')}
            </h2>
            <ul className="weakness-list">
              {archetype.weaknesses[t('language.current')].map((weakness, i) => (
                <li key={i} className="weakness-item">
                  <span className="weakness-bullet">✗</span>
                  {weakness}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Piloting Tips */}
        <section className="archetype-section">
          <h2 className="section-title">
            <span className="section-icon section-icon--accent" aria-hidden="true" />
            {t('archetypePage.tips')}
          </h2>
          <div className="tips-grid">
            {archetype.tips[t('language.current')].map((tip, i) => (
              <div key={i} className="tip-card">
                <span className="tip-number">{i + 1}</span>
                <p className="tip-text">{tip}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Example Decklists */}
        {archetype.exampleDecklists && archetype.exampleDecklists.length > 0 && (
          <section className="archetype-section">
            <h2 className="section-title">
              <span className="section-icon section-icon--accent" aria-hidden="true" />
              {t('archetypePage.exampleDecklists')}
            </h2>
            <DecklistViewer decklists={archetype.exampleDecklists} />
          </section>
        )}
      </div>
    </div>
  );
}
