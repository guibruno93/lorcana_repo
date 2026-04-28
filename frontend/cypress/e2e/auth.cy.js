describe('Authentication Flow', () => {
  const testEmail = `test${Date.now()}@inkwelllabs.com`;
  const testUsername = `testuser${Date.now()}`;
  const testPassword = 'Test@12345';

  beforeEach(() => {
    cy.cleanupTestData();
  });

  it('should register new user and auto-login when auto-approved', () => {
    cy.visit('/register');

    cy.get('input[name="username"]').type(testUsername);
    cy.get('input[type="email"]').first().type(testEmail);
    cy.get('input[type="password"]').first().type(testPassword);
    cy.get('input[name="confirmPassword"]').type(testPassword);

    cy.get('button[type="submit"]').contains(/Criar conta/i).click();

    cy.contains(/Conta criada/i, { timeout: 15000 }).should('be.visible');
    cy.url({ timeout: 20000 }).should('include', '/deck');
    cy.contains(testUsername).should('be.visible');
  });

  it('should login with existing user', () => {
    cy.registerViaApi().then((session) => {
      cy.cleanupTestData();
      cy.visit('/login');
      cy.get('input[type="email"]').first().type(session.email);
      cy.get('input[type="password"]').first().type(session.password);
      cy.get('button[type="submit"]').contains(/Entrar/i).click();
      cy.url({ timeout: 15000 }).should('include', '/deck');
      cy.contains(session.username).should('be.visible');
    });
  });

  it('should reject wrong password', () => {
    cy.registerViaApi().then((session) => {
      cy.cleanupTestData();
      cy.visit('/login');
      cy.get('input[type="email"]').first().type(session.email);
      cy.get('input[type="password"]').first().type('WrongPassword1');
      cy.get('button[type="submit"]').contains(/Entrar/i).click();
      cy.contains(/incorretos/i).should('be.visible');
      cy.url().should('include', '/login');
    });
  });

  it('should logout successfully', () => {
    cy.registerViaApi().then((session) => {
      cy.seedSessionFromApiUser(session);
      cy.visit('/deck');
      cy.contains('button', /Sair/i).click();
      cy.url({ timeout: 15000 }).should('satisfy', (href) =>
        href.endsWith('/') || href.includes('/login')
      );
    });
  });

  it('should show beta-related copy on login', () => {
    cy.visit('/login');
    cy.contains(/Beta/i).should('exist');
  });

  it('should toggle password visibility', () => {
    cy.visit('/login');
    cy.get('input[type="password"]').should('exist');
    cy.get('form').first().within(() => {
      cy.contains('button', /^Mostrar$/i).click();
    });
    cy.get('input[type="text"]').should('exist');
  });
});
