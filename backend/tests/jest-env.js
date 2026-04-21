// Executado primeiro (setupFiles), antes do código dos testes — evita ML a arrancar no import do server.
process.env.NODE_ENV = 'test';
