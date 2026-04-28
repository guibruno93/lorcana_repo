describe('Navigation (autenticado)', () => {
  beforeEach(() => {
    cy.cleanupTestData();
    cy.registerViaApi().then((session) => {
      cy.seedSessionFromApiUser(session);
    });
  });

  it('should navigate between main tabs', () => {
    cy.visit('/deck');
    cy.url().should('include', '/deck');

    cy.contains('button', /Cartas|Cards/i).click();
    cy.url().should('include', '/cards');

    cy.contains('button', /Meta/i).click();
    cy.url().should('include', '/meta');

    cy.contains('button', /Torneio|Tournament/i).click();
    cy.url().should('include', '/tournaments');
  });
});
