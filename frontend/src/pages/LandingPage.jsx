import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import './LandingPage.css';

const pub = process.env.PUBLIC_URL || '';

const FEATURES = [
  {
    icon: '📊',
    title: 'Análise de meta em tempo real',
    description:
      'Tier lists automáticos com dados reais de torneios. Veja quais arquétipos dominam o meta competitivo.',
    screenshot: `${pub}/screenshots/tier-list.svg`,
  },
  {
    icon: '🃏',
    title: 'Deckbuilder visual',
    description:
      'Monte decks com interface intuitiva. Filtros por tinta, custo e raridade, com validação de regras.',
    screenshot: `${pub}/screenshots/deckbuilder-full.svg`,
  },
  {
    icon: '🎲',
    title: 'Simulador de mulligan',
    description:
      'Teste mãos iniciais e mulligans alinhados às regras do Lorcana, com visualização das cartas.',
    screenshot: `${pub}/screenshots/mulligan.svg`,
  },
  {
    icon: '🔍',
    title: 'Base de cartas',
    description:
      'Explore o card database com busca, filtros e estatísticas de uso no meta.',
    screenshot: `${pub}/screenshots/card-database.svg`,
  },
  {
    icon: '⚔️',
    title: 'Matchups e análise de deck',
    description:
      'Cole sua decklist e veja a análise, curva de mana e ferramentas de preparação.',
    screenshot: `${pub}/screenshots/dashboard-preview.svg`,
  },
];

const SCREENSHOTS = [
  {
    src: `${pub}/screenshots/tier-list.svg`,
    alt: 'Tier list S/A/B/C',
    title: 'Tier list automático',
    caption: 'Tiers com base em meta share e desempenho em torneios.',
  },
  {
    src: `${pub}/screenshots/meta-share.svg`,
    alt: 'Gráfico de meta share',
    title: 'Distribuição do meta',
    caption: 'Popularidade dos decks por arquétipo.',
  },
  {
    src: `${pub}/screenshots/deckbuilder-full.svg`,
    alt: 'Deckbuilder',
    title: 'Construa decks com clareza',
    caption: 'Construa, exporte e mostre seu deck',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Crie sua conta',
    text: 'Registo gratuito em poucos minutos — sem cartão de crédito.',
  },
  {
    n: '2',
    title: 'Explore o meta',
    text: 'Consulte tiers, meta competitivo e dados agregados de torneios reais.',
  },
  {
    n: '3',
    title: 'Construa e teste',
    text: 'Use o deckbuilder, simulador de mulligan e análise de deck no dia a dia.',
  },
];

const FAQS = [
  {
    q: 'O Inkwell Labs é gratuito?',
    a: 'Sim. As funcionalidades principais são gratuitas: análise de meta, deckbuilder e base de cartas estão disponíveis sem custo.',
  },
  {
    q: 'De onde vêm os dados do meta?',
    a: 'Recolhemos dados automaticamente de fontes como Inkdecks (decks de eventos competitivos). O sistema atualiza quando novos decks são agregados.',
  },
  {
    q: 'Posso guardar os meus decks?',
    a: 'Com conta gratuita é possível criar novos decks; o deckbuilder e o analisador funcionam com as qualquer lista. Algumas funcionalidades podem mudar conforme o tempo — consulta o aplicativo após login.',
  },
  {
    q: 'Com que frequência o meta é atualizado?',
    a: 'As validações e os cálculos são executados de forma regular. A data da última recolha aparece no painel de meta.',
  },
  {
    q: 'Posso usar no meu celular?',
    a: 'Sim. A interface é responsiva e funciona em celulares, tablet e computadores desktop.',
  },
  {
    q: 'Como funciona o simulador de mulligan?',
    a: 'O sistema irá simular um embaralhamento da sua decklist e indicar uma mão inicial. Você pode optar por manter as cartas da sua mão ou indicar quais cartas deseja alterar, seguindo as regras do Disney Lorcana.',
  },
  {
    q: 'Quais expansões tem disponível?',
    a: 'A base de dados cobre as cartas disponíveis no serviço ligado ao projeto; Conforme novos sets são lançados o banco de dados também é atualizado. Confirme as datas de lançamentos de novas coleções.',
  },
  {
    q: 'Como reporto bugs ou dou sugestões?',
    a: 'Entre em contato pelo e-mail: contato@inkwelllabs.com ou deixe um feedback dentro da ferramenta quando disponível.',
  },
];

function LandingPage() {
  const navigate = useNavigate();

  const goRegister = () => navigate('/register?next=/deck');
  const goLoginDemo = () => navigate('/login?next=/meta');

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="landing-nav-brand" aria-label="Inkwell Labs — início">
          <Logo size="small" />
        </Link>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-link">
            Entrar
          </Link>
          <button type="button" className="landing-btn-nav" onClick={goRegister}>
            Registar
          </button>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-hero-bg" aria-hidden />
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-content">
            <div className="landing-hero-logo-wrap">
              <Logo size="large" animated />
            </div>
            <h1 id="landing-hero-title">
               Faça parte do competitivo de <span className="landing-gradient">Lorcana</span>
            </h1>
            <p className="landing-tagline">
              Análise de meta em tempo real, ferramenta inteligente feita por jogadores para
              jogadores competitivos de Disney Lorcana TCG.
            </p>
            <div className="landing-cta-row">
              <button type="button" className="landing-btn-primary" onClick={goRegister}>
                Começar grátis
              </button>
              <button type="button" className="landing-btn-secondary" onClick={goLoginDemo}>
                Ver demo
              </button>
            </div>
            <div className="landing-stats" role="list">
              <div className="landing-stat" role="listitem">
                <span className="landing-stat-num">1.700+</span>
                <span className="landing-stat-label">Decks analisados</span>
              </div>
              <div className="landing-stat" role="listitem">
                <span className="landing-stat-num">15+</span>
                <span className="landing-stat-label">Arquétipos rastreados</span>
              </div>
              <div className="landing-stat" role="listitem">
                <span className="landing-stat-num">100%</span>
                <span className="landing-stat-label">Dados de torneios</span>
              </div>
            </div>
          </div>
          <div className="landing-hero-visual">
            <img
              src={`${pub}/screenshots/dashboard-preview.svg`}
              alt="Pré-visualização do painel Inkwell Labs"
              className="landing-hero-shot"
              width={800}
              height={520}
            />
          </div>
        </div>
      </section>

      <section className="landing-section landing-features" aria-labelledby="feat-title">
        <div className="landing-container">
          <h2 id="feat-title" className="landing-section-title">
            Todas as ferramentas para entender Lorcana!
          </h2>
          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon" aria-hidden>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
                <img
                  src={f.screenshot}
                  alt=""
                  className="landing-feature-shot"
                  loading="lazy"
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-shots" aria-labelledby="shots-title">
        <div className="landing-container">
          <h2 id="shots-title" className="landing-section-title">
            Vê a ferramenta em ação
          </h2>
          <p className="landing-section-lead">
            Alterar para prints reais{' '}
            <code>public/screenshots/</code> por PNGs reais quando os tiver.
          </p>
          <div className="landing-shots-grid">
            {SCREENSHOTS.map((s) => (
              <figure key={s.title} className="landing-shot-card">
                <img src={s.src} alt={s.alt} className="landing-shot-img" loading="lazy" />
                <figcaption>
                  <h4>{s.title}</h4>
                  <p>{s.caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-how" aria-labelledby="how-title">
        <div className="landing-container">
          <h2 id="how-title" className="landing-section-title">
            Como funciona
          </h2>
          <ol className="landing-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="landing-step">
                <span className="landing-step-num">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section landing-faq" aria-labelledby="faq-title">
        <div className="landing-container landing-faq-inner">
          <h2 id="faq-title" className="landing-section-title">
            Perguntas frequentes
          </h2>
          <div className="landing-faq-list">
            {FAQS.map((faq) => (
              <details key={faq.q} className="landing-faq-item">
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-final" aria-labelledby="cta-final-title">
        <div className="landing-container landing-cta-inner">
          <h2 id="cta-final-title">Faça parte da história de Lorcana</h2>
          <p>Junte-se á outros jogadores competitivos com o Inkwell Labs.</p>
          <div className="landing-cta-row landing-cta-row--center">
            <button type="button" className="landing-btn-primary landing-btn-on-accent" onClick={goRegister}>
              Criar conta grátis
            </button>
            <a
              href="#feat-title"
              className="landing-btn-secondary landing-btn-ghost-light landing-btn-anchor"
            >
              Explorar features
            </a>
          </div>
          <p className="landing-cta-note">
            ✓ Sem cartão de crédito &nbsp;✓ Configuração rápida &nbsp;✓ Gratuito
          </p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <p>© {new Date().getFullYear()} Inkwell Labs. Projeto de fãs — Disney Lorcana™ é marca dos respetivos titulares.</p>
          <div className="landing-footer-links">
            <Link to="/terms">Termos</Link>
            <Link to="/privacy">Privacidade</Link>
            <a href="mailto:contato@inkwelllabs.com">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
