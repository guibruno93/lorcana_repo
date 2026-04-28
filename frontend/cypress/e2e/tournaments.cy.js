describe('Tournament Organizer', () => {
  beforeEach(() => {
    cy.cleanupTestData();
    cy.registerViaApi().then((session) => {
      cy.seedSessionFromApiUser(session);
    });
    cy.visit('/tournaments');
  });

  it('should create BO1 tournament and add players', () => {
    cy.contains('button', /^Criar$/).click();

    cy.get('section.tournament-org__form input').first().type('Cypress BO1');
    cy.get('input[type="date"]').first().type('2026-08-15');

    cy.contains('button', /Criar torneio/i).click();
    cy.on('window:alert', cy.stub());

    cy.contains('Cypress BO1', { timeout: 15000 }).should('be.visible');
    cy.contains('button', /Gerir/i).first().click();

    const players = ['P1', 'P2', 'P3', 'P4'];
    players.forEach((name) => {
      cy.get('input[placeholder*="jogador" i]').clear().type(name);
      cy.contains('button', /^Adicionar$/i).click();
    });

    cy.contains('button', /Iniciar torneio/i).click();
    cy.contains(/Ronda|Rodada/i, { timeout: 15000 }).should('be.visible');
    cy.get('.round-timer', { timeout: 5000 }).should('be.visible');
  });
});
