import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArchetypeWithIcons } from './InkIcons';
import './TierListGenerator.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const TIER_IDS = ['S', 'A', 'B', 'C', 'D'];
const POOL_ID = 'POOL';

const defaultLabels = () =>
  TIER_IDS.reduce((acc, t) => {
    acc[t] = t;
    return acc;
  }, {});

function dragId(archetype) {
  return `deck:${encodeURIComponent(archetype)}`;
}

function parseDragId(id) {
  if (typeof id !== 'string' || !id.startsWith('deck:')) return null;
  try {
    return decodeURIComponent(id.slice(5));
  } catch {
    return null;
  }
}

function collisionDetectionStrategy(args) {
  const a = pointerWithin(args);
  if (a.length) return a;
  return rectIntersection(args);
}

function DraggableArchetype({ archetype, percentage, disabled }) {
  const id = dragId(archetype);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: Boolean(disabled),
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tier-deck-item ${isDragging ? 'is-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <ArchetypeWithIcons archetype={archetype} size="md" />
      {percentage != null && (
        <span className="deck-meta">{Number(percentage).toFixed(1)}% meta</span>
      )}
    </div>
  );
}

function DroppableTier({ id, children, className, label, count }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`tier-drop-zone ${className || ''} ${isOver ? 'drop-over' : ''}`}
      data-tier={id}
    >
      <div className="tier-header">
        <h3>{label} TIER</h3>
        <span className="tier-count">
          {count} {count === 1 ? 'deck' : 'decks'}
        </span>
      </div>
      <div className="tier-decks">{children}</div>
    </div>
  );
}

function flattenOfficialTiers(apiTiers) {
  const map = {};
  if (!apiTiers || typeof apiTiers !== 'object') return map;
  for (const letter of ['S', 'A', 'B', 'C']) {
    const arr = apiTiers[letter];
    if (!Array.isArray(arr)) continue;
    arr.forEach((row) => {
      if (row?.archetype) map[row.archetype] = letter;
    });
  }
  return map;
}

function findTierForDeck(tiers, archetype) {
  for (const t of TIER_IDS) {
    if ((tiers[t] || []).some((d) => d.archetype === archetype)) return t;
  }
  return null;
}

export default function TierListGenerator() {
  const { t } = useTranslation();
  const { shareId } = useParams();
  const navigate = useNavigate();
  const isPublicView = Boolean(shareId);

  const [activeTab, setActiveTab] = useState('create');
  const [tierList, setTierList] = useState({
    id: null,
    title: '',
    description: '',
    tiers: {
      S: [],
      A: [],
      B: [],
      C: [],
      D: [],
    },
    tierLabels: defaultLabels(),
  });
  const [availableDecks, setAvailableDecks] = useState([]);
  const [activeDragId, setActiveDragId] = useState(null);
  const [savedLists, setSavedLists] = useState([]);
  const [communityLists, setCommunityLists] = useState([]);
  const [communitySort, setCommunitySort] = useState('popular');
  const [officialData, setOfficialData] = useState(null);
  const [voteStats, setVoteStats] = useState({ agree: 0, disagree: 0, likes: 0 });
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [publicError, setPublicError] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadArchetypes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/meta/share`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const list = (data.archetypes || []).map((a) => ({
        archetype: a.archetype,
        percentage: a.percentage,
      }));
      setAvailableDecks(list);
    } catch (e) {
      console.error(e);
      setAvailableDecks([]);
    }
  }, []);

  useEffect(() => {
    if (!isPublicView) loadArchetypes();
  }, [isPublicView, loadArchetypes]);

  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;
    (async () => {
      setLoadingPublic(true);
      setPublicError(false);
      try {
        const res = await fetch(`${API_URL}/api/tier-lists/${shareId}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        if (cancelled) return;
        setTierList({
          id: data.id,
          title: data.title || '',
          description: data.description || '',
          tiers: normalizeTiersFromApi(data.tiers),
          tierLabels: { ...defaultLabels(), ...(data.tier_labels || {}) },
        });
        setVoteStats({
          agree: data.agree || 0,
          disagree: data.disagree || 0,
          likes: data.likes || 0,
        });
      } catch {
        if (!cancelled) setPublicError(true);
      } finally {
        if (!cancelled) setLoadingPublic(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  useEffect(() => {
    if (activeTab !== 'official' && activeTab !== 'compare') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/meta/tier-list`);
        const data = await res.json();
        if (!cancelled) setOfficialData(data);
      } catch {
        if (!cancelled) setOfficialData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const refreshCommunity = useCallback(async () => {
    try {
      const q = communitySort === 'recent' ? 'recent' : 'popular';
      const res = await fetch(`${API_URL}/api/tier-lists/community?sort=${q}`);
      if (!res.ok) return;
      const data = await res.json();
      setCommunityLists(data.lists || []);
    } catch (e) {
      console.error(e);
    }
  }, [communitySort]);

  useEffect(() => {
    if (activeTab === 'community') refreshCommunity();
  }, [activeTab, refreshCommunity]);

  const refreshMine = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSavedLists([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/tier-lists/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSavedLists(data.lists || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my-lists') refreshMine();
  }, [activeTab, refreshMine]);

  const moveDeck = useCallback(
    (archetype, fromKey, toKey) => {
      if (fromKey === toKey) return;

      const copyTiers = (t) => ({
        S: [...(t.S || [])],
        A: [...(t.A || [])],
        B: [...(t.B || [])],
        C: [...(t.C || [])],
        D: [...(t.D || [])],
      });

      let nextPool = [...availableDecks];
      let nextTiers = copyTiers(tierList.tiers);

      if (fromKey === POOL_ID) {
        const pi = nextPool.findIndex((d) => d.archetype === archetype);
        if (pi < 0) return;
        const deckObj = { ...nextPool[pi] };
        nextPool.splice(pi, 1);
        if (toKey !== POOL_ID) {
          const dest = [...nextTiers[toKey]];
          if (dest.some((d) => d.archetype === archetype)) return;
          dest.push(deckObj);
          nextTiers[toKey] = dest;
        }
      } else if (toKey === POOL_ID) {
        const arr = [...nextTiers[fromKey]];
        const idx = arr.findIndex((d) => d.archetype === archetype);
        if (idx < 0) return;
        const deckObj = arr[idx];
        arr.splice(idx, 1);
        nextTiers[fromKey] = arr;
        if (!nextPool.some((d) => d.archetype === archetype)) {
          nextPool = [...nextPool, deckObj].sort((a, b) =>
            (a.archetype || '').localeCompare(b.archetype || '')
          );
        }
      } else {
        const fromArr = [...nextTiers[fromKey]];
        const idx = fromArr.findIndex((d) => d.archetype === archetype);
        if (idx < 0) return;
        const deckObj = fromArr[idx];
        fromArr.splice(idx, 1);
        nextTiers[fromKey] = fromArr;
        const dest = [...nextTiers[toKey]];
        if (dest.some((d) => d.archetype === archetype)) return;
        dest.push(deckObj);
        nextTiers[toKey] = dest;
      }

      setAvailableDecks(nextPool);
      setTierList((p) => ({ ...p, tiers: nextTiers }));
    },
    [availableDecks, tierList.tiers]
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveDragId(null);
      if (!over) return;
      const arch = parseDragId(active.id);
      if (!arch) return;
      const inTier = findTierForDeck(tierList.tiers, arch);
      const fromTier = inTier
        ? inTier
        : availableDecks.some((d) => d.archetype === arch)
          ? POOL_ID
          : null;
      if (fromTier == null) return;
      let toKey = over.id;
      if (typeof toKey !== 'string') return;
      if (!TIER_IDS.includes(toKey) && toKey !== POOL_ID) return;
      moveDeck(arch, fromTier, toKey);
    },
    [tierList.tiers, availableDecks, moveDeck]
  );

  const removeDeckFromTier = (archetype, tier) => {
    moveDeck(archetype, tier, POOL_ID);
  };

  const saveTierList = async () => {
    if (!tierList.title.trim()) {
      alert(t('tierList.titleRequired', 'Adiciona um título.'));
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/tier-lists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: tierList.title.trim(),
          description: tierList.description,
          tiers: tierList.tiers,
          tier_labels: tierList.tierLabels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      setTierList((p) => ({ ...p, id: data.id }));
      const raw = localStorage.getItem('tier_list_ids');
      let ids = [];
      try {
        ids = JSON.parse(raw || '[]');
      } catch {
        ids = [];
      }
      if (!ids.includes(data.id)) {
        ids.unshift(data.id);
        localStorage.setItem('tier_list_ids', JSON.stringify(ids.slice(0, 50)));
      }
      alert(t('tierList.savedOk', 'Tier list guardada.'));
      refreshMine();
    } catch (e) {
      console.error(e);
      alert(t('tierList.saveFail', 'Erro ao guardar.'));
    }
  };

  const shareTierList = async () => {
    if (!tierList.id) {
      alert(t('tierList.saveFirst', 'Guarda a tier list primeiro.'));
      return;
    }
    const url = `${window.location.origin}/tier-lists/${tierList.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert(t('tierList.linkCopied', 'Link copiado.'));
    } catch {
      window.prompt(t('tierList.copyLink', 'Copia o link:'), url);
    }
  };

  const embedCode = tierList.id
    ? `<iframe src="${window.location.origin}/tier-lists/${tierList.id}" width="100%" height="720" style="border:0;border-radius:12px" loading="lazy"></iframe>`
    : '';

  const vote = async (v) => {
    if (!tierList.id) return;
    const key = `tier_vote_${tierList.id}_${v}`;
    if (localStorage.getItem(key)) {
      alert(t('tierList.alreadyVoted', 'Já votaste nesta lista.'));
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/tier-lists/${tierList.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem(key, '1');
      setVoteStats((s) => ({
        ...s,
        agree: data.agree ?? s.agree + (v === 'agree' ? 1 : 0),
        disagree: data.disagree ?? s.disagree + (v === 'disagree' ? 1 : 0),
      }));
    } catch (e) {
      alert(e.message || 'vote failed');
    }
  };

  const likeList = async () => {
    if (!tierList.id) return;
    try {
      const res = await fetch(`${API_URL}/api/tier-lists/${tierList.id}/like`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) setVoteStats((s) => ({ ...s, likes: data.likes ?? s.likes + 1 }));
    } catch {
      /* ignore */
    }
  };

  const officialMap = useMemo(
    () => flattenOfficialTiers(officialData?.tiers),
    [officialData]
  );

  const comparisonRows = useMemo(() => {
    const rows = [];
    const userMap = {};
    TIER_IDS.forEach((tid) => {
      (tierList.tiers[tid] || []).forEach((d) => {
        userMap[d.archetype] = tid;
      });
    });
    const allArch = new Set([
      ...Object.keys(userMap),
      ...Object.keys(officialMap),
    ]);
    allArch.forEach((arch) => {
      const u = userMap[arch];
      const o = officialMap[arch];
      let heat = 'na';
      if (u && o) {
        const diff = Math.abs(TIER_IDS.indexOf(u) - TIER_IDS.indexOf(o));
        if (diff === 0) heat = 'match';
        else if (diff === 1) heat = 'close';
        else heat = 'far';
      }
      rows.push({ arch, user: u, official: o, heat });
    });
    return rows.sort((a, b) => a.arch.localeCompare(b.arch));
  }, [tierList.tiers, officialMap]);

  const agreementPct = useMemo(() => {
    const withOff = comparisonRows.filter((r) => r.user && r.official);
    if (!withOff.length) return null;
    const match = withOff.filter((r) => r.heat === 'match').length;
    return Math.round((match / withOff.length) * 100);
  }, [comparisonRows]);

  const activeArch = activeDragId ? parseDragId(activeDragId) : null;

  if (isPublicView && loadingPublic) {
    return (
      <div className="tier-list-generator">
        <p className="community-empty">{t('common.loading', 'A carregar…')}</p>
      </div>
    );
  }

  if (isPublicView && publicError) {
    return (
      <div className="tier-list-generator tier-list-public">
        <p className="community-empty">
          {t('tierList.notFound', 'Tier list não encontrada.')}
        </p>
        <a className="btn-secondary public-home-link" href="/">
          {t('common.back')}
        </a>
      </div>
    );
  }

  if (isPublicView) {
    return (
      <div className="tier-list-generator tier-list-public">
        <div className="generator-header">
          <h1>{tierList.title || 'Tier list'}</h1>
          {tierList.description && (
            <p className="public-desc">{tierList.description}</p>
          )}
        </div>
        <div className="tiers-container read-only">
          {TIER_IDS.map((tid) => (
            <div key={tid} className={`tier tier-${tid}`}>
              <div className="tier-header">
                <h3>{tid} TIER</h3>
                <span className="tier-count">
                  {(tierList.tiers[tid] || []).length}
                </span>
              </div>
              <div className="tier-decks">
                {(tierList.tiers[tid] || []).map((d) => (
                  <div key={d.archetype} className="tier-deck-item">
                    <ArchetypeWithIcons archetype={d.archetype} size="md" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="public-votes">
          <button type="button" className="btn-primary" onClick={() => vote('agree')}>
            {t('tierList.agree', 'Concordo')} ({voteStats.agree})
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => vote('disagree')}
          >
            {t('tierList.disagree', 'Discordo')} ({voteStats.disagree})
          </button>
          <button type="button" className="btn-secondary" onClick={likeList}>
            {t('tierList.like', 'Gosto')} ({voteStats.likes})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tier-list-generator">
      <div className="generator-header">
        <h1>{t('tierList.title', 'Gerador de Tier Lists')}</h1>
        <div className="tabs">
          {['create', 'my-lists', 'community', 'official', 'compare'].map(
            (tab) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? 'active' : ''}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'create' && t('tierList.tabCreate', 'Nova')}
                {tab === 'my-lists' && t('tierList.tabMine', 'Minhas')}
                {tab === 'community' && t('tierList.tabCommunity', 'Comunidade')}
                {tab === 'official' && t('tierList.tabOfficial', 'Oficial')}
                {tab === 'compare' && t('tierList.tabCompare', 'Comparar')}
              </button>
            )
          )}
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="create-tier-list">
          <div className="tier-list-meta">
            <input
              type="text"
              className="tier-list-title"
              placeholder={t('tierList.placeholderTitle', 'Título da tier list')}
              value={tierList.title}
              onChange={(e) =>
                setTierList((p) => ({ ...p, title: e.target.value }))
              }
            />
            <textarea
              className="tier-list-description"
              placeholder={t(
                'tierList.placeholderDesc',
                'Descrição (opcional)'
              )}
              value={tierList.description}
              onChange={(e) =>
                setTierList((p) => ({ ...p, description: e.target.value }))
              }
            />
            <div className="tier-labels-row">
              {TIER_IDS.map((tid) => (
                <label key={tid} className="tier-label-edit">
                  <span>{tid}</span>
                  <input
                    type="text"
                    value={tierList.tierLabels[tid] || tid}
                    onChange={(e) =>
                      setTierList((p) => ({
                        ...p,
                        tierLabels: {
                          ...p.tierLabels,
                          [tid]: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={(e) => setActiveDragId(e.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="tiers-container">
              {TIER_IDS.map((tid) => (
                <DroppableTier
                  key={tid}
                  id={tid}
                  className={`tier tier-${tid}`}
                  label={tierList.tierLabels[tid] || tid}
                  count={(tierList.tiers[tid] || []).length}
                >
                  {(tierList.tiers[tid] || []).map((d) => (
                    <div key={d.archetype} className="tier-deck-wrap">
                      <DraggableArchetype
                        archetype={d.archetype}
                        percentage={d.percentage}
                      />
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeDeckFromTier(d.archetype, tid)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(tierList.tiers[tid] || []).length === 0 && (
                    <div className="tier-empty">
                      {t('tierList.dropHere', 'Arrasta decks para aqui')}
                    </div>
                  )}
                </DroppableTier>
              ))}
            </div>

            <div className="available-decks">
              <h3>{t('tierList.available', 'Decks disponíveis')}</h3>
              <p className="help-text">
                {t('tierList.dragHint', 'Arrasta para os tiers acima')}
              </p>
              <DroppableTier
                id={POOL_ID}
                className="pool-droppable"
                label={t('tierList.pool', 'Pool')}
                count={availableDecks.length}
              >
                <div className="decks-pool">
                  {availableDecks.map((d) => (
                    <DraggableArchetype
                      key={d.archetype}
                      archetype={d.archetype}
                      percentage={d.percentage}
                    />
                  ))}
                </div>
                {availableDecks.length === 0 && (
                  <div className="tier-empty">
                    {t('tierList.poolEmpty', 'Todas as cartas estão nos tiers')}
                  </div>
                )}
              </DroppableTier>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeArch ? (
                <div className="dragging-item">
                  <ArchetypeWithIcons archetype={activeArch} size="md" />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <div className="tier-list-actions">
            <button type="button" className="btn-primary" onClick={saveTierList}>
              {t('tierList.save', 'Guardar')}
            </button>
            <button type="button" className="btn-secondary" onClick={shareTierList}>
              {t('tierList.share', 'Partilhar')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                tierList.id &&
                window.open(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    tierList.title
                  )}&url=${encodeURIComponent(
                    `${window.location.origin}/tier-lists/${tierList.id}`
                  )}`,
                  '_blank'
                )
              }
              disabled={!tierList.id}
            >
              𝕏 Twitter
            </button>
          </div>

          {embedCode && (
            <div className="embed-block">
              <label>{t('tierList.embed', 'Código embed')}</label>
              <textarea readOnly rows={3} value={embedCode} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-lists' && (
        <div className="my-tier-lists">
          <h2>{t('tierList.myLists', 'As minhas tier lists')}</h2>
          {savedLists.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon empty-icon--muted" aria-hidden="true" />
              <p>{t('tierList.emptyMine', 'Ainda não há listas guardadas (com login).')}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab('create')}
              >
                {t('tierList.createFirst', 'Criar')}
              </button>
            </div>
          ) : (
            <div className="tier-lists-grid">
              {savedLists.map((list) => (
                <div key={list.id} className="tier-list-card">
                  <h3>{list.title}</h3>
                  <p>{list.description}</p>
                  <div className="card-stats">
                    <span>{t('tierList.agree', 'Concordo')}: {list.agree ?? 0}</span>
                    <span>{t('tierList.disagree', 'Discordo')}: {list.disagree ?? 0}</span>
                    <span>{t('tierList.like', 'Gosto')}: {list.likes ?? 0}</span>
                  </div>
                  <div className="card-actions">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`/tier-lists/${list.id}`, '_blank')
                      }
                    >
                      {t('tierList.view', 'Ver')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${window.location.origin}/tier-lists/${list.id}`
                        )
                      }
                    >
                      {t('tierList.share', 'Partilhar')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'community' && (
        <div className="community-tier-lists">
          <h2>{t('tierList.communityTitle', 'Comunidade')}</h2>
          <div className="filters">
            <select
              value={communitySort}
              onChange={(e) => setCommunitySort(e.target.value)}
            >
              <option value="popular">
                {t('tierList.sortPopular', 'Mais populares')}
              </option>
              <option value="recent">
                {t('tierList.sortRecent', 'Mais recentes')}
              </option>
            </select>
          </div>
          <div className="tier-lists-grid">
            {communityLists.map((list) => (
              <div key={list.id} className="tier-list-card">
                <h3>{list.title}</h3>
                <p>{list.description}</p>
                <div className="card-stats">
                  <span>{t('tierList.like', 'Gosto')}: {list.likes ?? 0}</span>
                  <span>{t('tierList.agree', 'Concordo')}: {list.agree ?? 0}</span>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate(`/tier-lists/${list.id}`)}
                >
                  {t('tierList.open', 'Abrir')}
                </button>
              </div>
            ))}
          </div>
          {communityLists.length === 0 && (
            <p className="community-empty">
              {t('tierList.noCommunity', 'Sem listas públicas ainda.')}
            </p>
          )}
        </div>
      )}

      {activeTab === 'official' && (
        <div className="official-tier-list">
          <h2>{t('tierList.officialTitle', 'Tier list oficial (scraped)')}</h2>
          <p>
            {t(
              'tierList.officialHint',
              'Baseada em dados de torneios (scraped_decks).'
            )}
          </p>
          {officialData?.generated_at && (
            <div className="update-info">
              <span>
                {t('tierList.generatedAt', 'Gerado')}:{' '}
                {new Date(officialData.generated_at).toLocaleString()}
              </span>
            </div>
          )}
          <div className="tiers-container read-only">
            {['S', 'A', 'B', 'C'].map((tid) => (
              <div key={tid} className={`tier tier-${tid}`}>
                <div className="tier-header">
                  <h3>{tid}</h3>
                </div>
                <div className="tier-decks">
                  {(officialData?.tiers?.[tid] || []).map((row) => (
                    <div key={row.archetype} className="tier-deck-item">
                      <ArchetypeWithIcons archetype={row.archetype} size="md" />
                      <span className="deck-meta">
                        {row.meta_share}% · {row.deck_count} decks
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="compare-tier-lists">
          <h2>{t('tierList.compareTitle', 'A tua lista vs meta oficial')}</h2>
          {agreementPct != null && (
            <p className="agreement-pill">
              {t('tierList.agreement', 'Concordância (mesmo tier)')}:{' '}
              <strong>{agreementPct}%</strong>
            </p>
          )}
          <p className="help-text">
            {t(
              'tierList.compareHint',
              'Abre o separador Oficial para carregar dados; compara com a lista no editor.'
            )}
          </p>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>{t('tierList.colArch', 'Arquétipo')}</th>
                  <th>{t('tierList.colYours', 'Tu')}</th>
                  <th>{t('tierList.colOfficial', 'Oficial')}</th>
                  <th>{t('tierList.colHeat', 'Match')}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((r) => (
                  <tr key={r.arch} className={`heat-${r.heat}`}>
                    <td>
                      <ArchetypeWithIcons archetype={r.arch} size="sm" />
                    </td>
                    <td>{r.user || '—'}</td>
                    <td>{r.official || '—'}</td>
                    <td>
                      {r.heat === 'match' && 'OK'}
                      {r.heat === 'close' && '◑'}
                      {r.heat === 'far' && '△'}
                      {r.heat === 'na' && '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeTiersFromApi(tiers) {
  const base = { S: [], A: [], B: [], C: [], D: [] };
  if (!tiers) return base;
  let obj = tiers;
  if (typeof tiers === 'string') {
    try {
      obj = JSON.parse(tiers);
    } catch {
      return base;
    }
  }
  for (const k of TIER_IDS) {
    if (Array.isArray(obj[k])) base[k] = obj[k];
  }
  return base;
}
