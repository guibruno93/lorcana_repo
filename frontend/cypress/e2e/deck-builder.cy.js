describe('Deck Builder', () => {
  beforeEach(() => {
    cy.cleanupTestData();
    cy.registerViaApi().then((session) => {
      cy.seedSessionFromApiUser(session);
    });
    cy.visit('/deck-builder', { timeout: 30000 });
  });

  it('should load deck builder page', () => {
    cy.get('h1.deck-name', { timeout: 20000 }).should('be.visible');
    cy.get('.visual-grid-search-input').should('be.visible');
  });

  it('should filter cards in the grid search', () => {
    cy.get('.visual-grid-search-input').clear().type('Elsa');
    cy.get('.visual-card-tile', { timeout: 20000 }).should('have.length.greaterThan', 0);
  });

  it('should add a card via grid tile', () => {
    cy.get('.visual-grid-search-input').clear().type('Ariel');
    cy.get('.visual-card-tile', { timeout: 20000 }).first().within(() => {
      cy.get('button[aria-label*="Adicionar" i]').click();
    });
    cy.contains(/Total de Cartas|Total/i).should('be.visible');
  });

  it('should open export modal', () => {
    cy.contains('button', /^Exportar$/i).click();
    cy.get('.export-text', { timeout: 10000 }).should('exist');
  });
});
