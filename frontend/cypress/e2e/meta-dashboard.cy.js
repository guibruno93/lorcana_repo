describe('Meta dashboard', () => {
  beforeEach(() => {
    cy.cleanupTestData();
    cy.registerViaApi().then((session) => {
      cy.seedSessionFromApiUser(session);
    });
    cy.visit('/meta', { timeout: 30000 });
  });

  it('should load meta page without hard error', () => {
    cy.get('body', { timeout: 20000 }).should('be.visible');
    cy.contains(/meta|Meta|arquétipo|arquetipo/i).should('exist');
  });
});
