import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import {
  fetchAllCards,
  getCardImageUrl,
  estimateCardPriceUsd,
} from '../services/cardService';
import './CardCollection.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
const LS_KEY = 'lorcana_collection_sync_v1';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CardCollection() {
  const { user } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('collection');
  const [cards, setCards] = useState([]);
  const [entries, setEntries] = useState({});
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collFilters, setCollFilters] = useState({
    search: '',
    owned: 'all',
  });
  const [wishPriority, setWishPriority] = useState('medium');
  const [collPage, setCollPage] = useState(1);
  const pageSize = 24;
  const [canSync, setCanSync] = useState(
    () => !localStorage.getItem('token')
  );

  const persistBlob = useMemo(
    () => JSON.stringify({ entries, wishlist }),
    [entries, wishlist]
  );
  const debouncedPersist = useDebounce(persistBlob, 500);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAllCards();
        if (!cancelled) setCards(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.entries && typeof o.entries === 'object') setEntries(o.entries);
        if (Array.isArray(o.wishlist)) setWishlist(o.wishlist);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCanSync(true);
      return;
    }
    setCanSync(false);
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/collection/me`, {
          headers: { ...authHeaders() },
        });
        if (!r.ok) {
          if (!cancelled) setCanSync(true);
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        if (data.cards && typeof data.cards === 'object') setEntries(data.cards);
        if (Array.isArray(data.wishlist)) setWishlist(data.wishlist);
      } catch (e) {
        console.warn('collection sync:', e);
      } finally {
        if (!cancelled) setCanSync(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ entries, wishlist, updatedAt: Date.now() })
      );
    } catch {
      /* ignore */
    }
    const token = localStorage.getItem('token');
    if (!token || !canSync) return;
    (async () => {
      try {
        await fetch(`${API_URL}/api/collection/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ entries, wishlist }),
        });
      } catch (e) {
        console.warn('collection PUT:', e);
      }
    })();
  }, [debouncedPersist, canSync]);

  const stats = useMemo(() => {
    const totalQty = Object.values(entries).reduce(
      (s, e) => s + (e.quantity || 0),
      0
    );
    const unique = Object.keys(entries).filter((id) => entries[id]?.quantity > 0)
      .length;
    let value = 0;
    for (const [cardId, e] of Object.entries(entries)) {
      if (!e || e.quantity <= 0) continue;
      const card = cards.find((c) => c.id === cardId);
      if (card) value += estimateCardPriceUsd(card) * e.quantity;
    }
    const completion =
      cards.length > 0 ? Math.round((unique / cards.length) * 100) : 0;
    return { totalQty, unique, value, completion };
  }, [entries, cards]);

  const valueByRarity = useMemo(() => {
    const map = {};
    for (const [cardId, e] of Object.entries(entries)) {
      if (!e || e.quantity <= 0) continue;
      const card = cards.find((c) => c.id === cardId);
      if (!card) continue;
      const r = card.rarity || '—';
      const v = estimateCardPriceUsd(card) * e.quantity;
      map[r] = (map[r] || 0) + v;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries, cards]);

  const valueBySet = useMemo(() => {
    const map = {};
    for (const [cardId, e] of Object.entries(entries)) {
      if (!e || e.quantity <= 0) continue;
      const card = cards.find((c) => c.id === cardId);
      if (!card) continue;
      const s = card.set_name || card.set_code || '—';
      const v = estimateCardPriceUsd(card) * e.quantity;
      map[s] = (map[s] || 0) + v;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries, cards]);

  const setEntry = useCallback((cardId, patch) => {
    setEntries((prev) => {
      const cur = prev[cardId] || {
        quantity: 0,
        physical: true,
        digital: false,
        condition: 'Mint',
      };
      const next = { ...cur, ...patch };
      if (next.quantity <= 0) {
        const { [cardId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [cardId]: next };
    });
  }, []);

  const updateQuantity = (cardId, quantity) => {
    setEntry(cardId, { quantity });
  };

  const toggleWishlist = (cardId) => {
    const exists = wishlist.some((w) => w.cardId === cardId);
    if (exists) {
      setWishlist((w) => w.filter((x) => x.cardId !== cardId));
      return;
    }
    setWishlist((w) => [...w, { cardId, priority: wishPriority }]);
  };

  const setWishPriorityFor = (cardId, priority) => {
    setWishlist((w) =>
      w.map((x) => (x.cardId === cardId ? { ...x, priority } : x))
    );
  };

  const filteredCollectionCards = useMemo(() => {
    const q = collFilters.search.trim().toLowerCase();
    return cards.filter((card) => {
      if (q && !card.name?.toLowerCase().includes(q)) return false;
      const owned = entries[card.id]?.quantity > 0;
      if (collFilters.owned === 'owned' && !owned) return false;
      if (collFilters.owned === 'missing' && owned) return false;
      return true;
    });
  }, [cards, collFilters, entries]);

  const collPaginated = useMemo(() => {
    const start = (collPage - 1) * pageSize;
    return {
      slice: filteredCollectionCards.slice(start, start + pageSize),
      totalPages: Math.max(1, Math.ceil(filteredCollectionCards.length / pageSize)),
    };
  }, [filteredCollectionCards, collPage, pageSize]);

  useEffect(() => {
    setCollPage(1);
  }, [collFilters.search, collFilters.owned]);

  const wishlistTotal = useMemo(() => {
    return wishlist.reduce((sum, w) => {
      const c = cards.find((x) => x.id === w.cardId);
      return sum + (c ? estimateCardPriceUsd(c) : 0);
    }, 0);
  }, [wishlist, cards]);

  const [deckSuggestions, setDeckSuggestions] = useState(null);

  useEffect(() => {
    if (activeTab !== 'decks') return;
    const token = localStorage.getItem('token');
    if (!token) {
      setDeckSuggestions({ decks: [], message: 'Inicie sessão para sincronizar a coleção no servidor.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/collection/me/deck-suggestions`, {
          headers: { ...authHeaders() },
        });
        const data = r.ok ? await r.json() : { decks: [] };
        if (!cancelled) setDeckSuggestions(data);
      } catch {
        if (!cancelled) setDeckSuggestions({ decks: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  if (loading) {
    return (
      <div className="card-collection card-collection--loading">
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
        <p>A carregar cartas…</p>
      </div>
    );
  }

  return (
    <div className="card-collection">
      <header className="card-collection__header">
        <h1>Minha coleção</h1>
        <nav className="card-collection__tabs" aria-label="Secções">
          {[
            ['collection', 'Coleção'],
            ['wishlist', `Wishlist (${wishlist.length})`],
            ['value', 'Valor'],
            ['decks', 'Decks'],
            ['trades', 'Trades'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? 'is-active' : ''}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <section className="card-collection__stats" aria-label="Resumo">
        <div className="card-collection__stat">
          <div className="card-collection__stat-value">{stats.totalQty}</div>
          <div className="card-collection__stat-label">Total (cópias)</div>
        </div>
        <div className="card-collection__stat">
          <div className="card-collection__stat-value">{stats.unique}</div>
          <div className="card-collection__stat-label">Cartas únicas</div>
        </div>
        <div className="card-collection__stat">
          <div className="card-collection__stat-value">
            ${stats.value.toFixed(2)}
          </div>
          <div className="card-collection__stat-label">Valor estimado</div>
        </div>
        <div className="card-collection__stat">
          <div className="card-collection__stat-value">{stats.completion}%</div>
          <div className="card-collection__stat-label">Catálogo</div>
        </div>
      </section>

      {activeTab === 'collection' && (
        <div className="card-collection__panel">
          <div className="card-collection__toolbar">
            <input
              type="search"
              className="card-collection__search"
              placeholder="Buscar na coleção…"
              value={collFilters.search}
              onChange={(e) =>
                setCollFilters((f) => ({ ...f, search: e.target.value }))
              }
            />
            <select
              className="card-collection__select"
              value={collFilters.owned}
              onChange={(e) =>
                setCollFilters((f) => ({ ...f, owned: e.target.value }))
              }
            >
              <option value="all">Todas</option>
              <option value="owned">Só possuo</option>
              <option value="missing">Só em falta</option>
            </select>
            <label className="card-collection__wish-prio">
              Prioridade wishlist:
              <select
                value={wishPriority}
                onChange={(e) => setWishPriority(e.target.value)}
              >
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </label>
          </div>

          <div className="card-collection__grid">
            {collPaginated.slice.map((card) => {
              const entry = entries[card.id] || {
                quantity: 0,
                physical: true,
                digital: false,
                condition: 'Mint',
              };
              const inWish = wishlist.some((w) => w.cardId === card.id);
              const img = getCardImageUrl(card);
              const price = estimateCardPriceUsd(card);

              return (
                <article key={card.id} className="card-collection__card">
                  <div className="card-collection__img-wrap">
                    {img ? (
                      <img src={img} alt="" />
                    ) : (
                      <div className="card-collection__img-ph">🃏</div>
                    )}
                    {entry.quantity > 0 && (
                      <span className="card-collection__qty-badge">{entry.quantity}×</span>
                    )}
                    {inWish && <span className="card-collection__wish-badge">★</span>}
                  </div>
                  <div className="card-collection__body">
                    <h3 className="card-collection__name">{card.name}</h3>
                    <p className="card-collection__price">
                      {price > 0 ? `$${price.toFixed(2)}` : '—'}
                    </p>
                    <div className="card-collection__qty">
                      <span>Possuo</span>
                      <div className="card-collection__qty-btns">
                        {[0, 1, 2, 3, 4].map((q) => (
                          <button
                            key={q}
                            type="button"
                            className={entry.quantity === q ? 'is-active' : ''}
                            onClick={() => updateQuantity(card.id, q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                    {entry.quantity > 0 && (
                      <>
                        <label className="card-collection__check">
                          <input
                            type="checkbox"
                            checked={entry.physical}
                            onChange={(e) =>
                              setEntry(card.id, { physical: e.target.checked })
                            }
                          />
                          Físico
                        </label>
                        <label className="card-collection__check">
                          <input
                            type="checkbox"
                            checked={entry.digital}
                            onChange={(e) =>
                              setEntry(card.id, { digital: e.target.checked })
                            }
                          />
                          Digital
                        </label>
                        <label className="card-collection__cond">
                          Condição
                          <select
                            value={entry.condition || 'Mint'}
                            onChange={(e) =>
                              setEntry(card.id, { condition: e.target.value })
                            }
                          >
                            <option value="Mint">Mint</option>
                            <option value="Near Mint">Near Mint</option>
                            <option value="Played">Played</option>
                          </select>
                        </label>
                      </>
                    )}
                    <button
                      type="button"
                      className={
                        inWish
                          ? 'card-collection__btn-wish is-on'
                          : 'card-collection__btn-wish'
                      }
                      onClick={() => toggleWishlist(card.id)}
                    >
                      {inWish ? 'Na wishlist' : 'Wishlist'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {collPaginated.totalPages > 1 && (
            <div className="card-collection__pager">
              <button
                type="button"
                disabled={collPage <= 1}
                onClick={() => setCollPage((p) => p - 1)}
              >
                ←
              </button>
              <span>
                Página {collPage} / {collPaginated.totalPages}
              </span>
              <button
                type="button"
                disabled={collPage >= collPaginated.totalPages}
                onClick={() => setCollPage((p) => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="card-collection__panel">
          {wishlist.length === 0 ? (
            <p className="card-collection__empty">Wishlist vazia.</p>
          ) : (
            <ul className="card-collection__wishlist">
              {wishlist.map((w) => {
                const c = cards.find((x) => x.id === w.cardId);
                if (!c) return null;
                const img = getCardImageUrl(c);
                return (
                  <li key={w.cardId} className="card-collection__wish-row">
                    {img ? <img src={img} alt="" /> : <div className="card-collection__img-ph sm">🃏</div>}
                    <div>
                      <strong>{c.name}</strong>
                      <div className="card-collection__wish-meta">
                        ${estimateCardPriceUsd(c).toFixed(2)}
                        <select
                          value={w.priority}
                          onChange={(e) =>
                            setWishPriorityFor(w.cardId, e.target.value)
                          }
                        >
                          <option value="high">Alta</option>
                          <option value="medium">Média</option>
                          <option value="low">Baixa</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setWishlist((l) => l.filter((x) => x.cardId !== w.cardId))
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="card-collection__wish-sum">
            Valor estimado da wishlist: <strong>${wishlistTotal.toFixed(2)}</strong>
          </p>
          <p className="card-collection__hint">
            Alertas de preço: em breve (notificação quando o preço baixar).
          </p>
        </div>
      )}

      {activeTab === 'value' && (
        <div className="card-collection__panel">
          <h2 className="card-collection__h2">Valor por raridade</h2>
          <ul className="card-collection__breakdown">
            {valueByRarity.length === 0 ? (
              <li>Sem dados — adiciona cartas à coleção.</li>
            ) : (
              valueByRarity.map(([r, v]) => (
                <li key={r}>
                  <span>{r}</span>
                  <span>${v.toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
          <h2 className="card-collection__h2">Valor por expansão</h2>
          <ul className="card-collection__breakdown">
            {valueBySet.length === 0 ? (
              <li>—</li>
            ) : (
              valueBySet.slice(0, 20).map(([s, v]) => (
                <li key={s}>
                  <span>{s}</span>
                  <span>${v.toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
          <h2 className="card-collection__h2">Evolução no tempo</h2>
          <p className="card-collection__soon">Em breve (histórico e gráfico).</p>
        </div>
      )}

      {activeTab === 'decks' && (
        <div className="card-collection__panel">
          <p className="card-collection__muted">
            {deckSuggestions?.message ||
              'Sugestões de decks com base na tua coleção virão numa próxima iteração.'}
          </p>
        </div>
      )}

      {activeTab === 'trades' && (
        <div className="card-collection__panel">
          <p className="card-collection__muted">
            Matching com outros jogadores e propostas de trade: em breve.
          </p>
        </div>
      )}
    </div>
  );
}
