const apiBase = () => Cypress.env('apiUrl') || 'http://localhost:3002/api';

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('input[type="email"]').first().clear().type(email);
  cy.get('input[type="password"]').first().clear().type(password);
  cy.get('button[type="submit"]').contains(/Entrar/i).click();
  cy.url({ timeout: 15000 }).should('not.include', '/login');
});

Cypress.Commands.add('registerViaApi', () => {
  const ts = Date.now();
  const username = `cyuser${ts}`;
  const email = `cyuser${ts}@inkwelllabs.com`;
  const password = 'Test@12345';

  return cy
    .request({
      method: 'POST',
      url: `${apiBase()}/auth/register`,
      body: {
        username,
        email,
        password,
        country: 'BR',
      },
      failOnStatusCode: false,
    })
    .then((res) => {
      if (res.status !== 201 || !res.body?.token) {
        throw new Error(
          `Registo API falhou (${res.status}). Defina AUTO_APPROVE_USERS=true no backend.`
        );
      }
      cy.wrap(
        {
          username,
          email,
          password,
          token: res.body.token,
          user: res.body.user,
        },
        { log: false }
      );
    });
});

Cypress.Commands.add('seedSessionFromApiUser', (session) => {
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', session.token);
      win.localStorage.setItem('user', JSON.stringify(session.user));
    },
  });
});

Cypress.Commands.add('logout', () => {
  cy.contains('button', /Sair/i).click();
  cy.url({ timeout: 10000 }).should('satisfy', (href) =>
    /\/(\?|$)/.test(href) || href.includes('/login')
  );
});

Cypress.Commands.add('cleanupTestData', () => {
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
});
