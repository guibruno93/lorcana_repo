const { exec } = require('child_process');
const path = require('path');
const { checkBackendHealth } = require('./validation/backend-health');
const { checkFrontendHealth } = require('./validation/frontend-health');
const { checkDatabaseHealth } = require('./validation/database-health');
const { testFullUserFlow } = require('./validation/full-flow');

const rootDir = path.join(__dirname, '..');

function runCommand(args, cwd) {
  const cmd =
    process.platform === 'win32'
      ? `npm.cmd ${args.join(' ')}`
      : `npm ${args.join(' ')}`;
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      {
        cwd: cwd || rootDir,
        env: process.env,
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

async function runAllTests() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  INKWELL LABS - AUTOMATED TEST SUITE');
  console.log('='.repeat(60));
  console.log('\n');

  const results = {
    backendHealth: null,
    frontendHealth: null,
    databaseHealth: null,
    backendTests: false,
    frontendTests: false,
    fullFlow: null,
    startTime: new Date(),
    endTime: null,
    duration: null,
  };

  try {
    console.log('\nSTEP 1: Backend Health Check\n');
    results.backendHealth = await checkBackendHealth();

    if (!results.backendHealth.server) {
      throw new Error(
        'Backend não responde. Inicie com: cd backend && npm start'
      );
    }

    console.log('\nSTEP 2: Frontend Health Check\n');
    results.frontendHealth = await checkFrontendHealth();

    console.log('\nSTEP 3: Database / data API check\n');
    results.databaseHealth = await checkDatabaseHealth();

    console.log('\nSTEP 4: Backend Jest tests\n');
    try {
      await runCommand(['test'], path.join(rootDir, 'backend'));
      results.backendTests = true;
    } catch (error) {
      console.error('Backend tests failed:', error.message);
      results.backendTests = false;
    }

    if (process.env.RUN_E2E === 'true') {
      console.log('\nSTEP 5: Frontend E2E (Cypress)\n');
      try {
        await runCommand(['run', 'cypress:run'], path.join(rootDir, 'frontend'));
        results.frontendTests = true;
      } catch (error) {
        console.error('Frontend E2E tests failed');
        results.frontendTests = false;
      }
    } else {
      console.log('\nSTEP 5: Frontend E2E (SKIPPED — defina RUN_E2E=true)\n');
    }

    console.log('\nSTEP 6: Full user flow script\n');
    results.fullFlow = await testFullUserFlow();
  } catch (error) {
    console.error('\nTEST SUITE FAILED:', error.message);
  } finally {
    results.endTime = new Date();
    results.duration = (results.endTime - results.startTime) / 1000;
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(
    `Backend Server:     ${results.backendHealth?.server ? 'OK' : 'FAIL'}`
  );
  console.log(
    `Cards / data API:   ${results.databaseHealth?.cardsSearch ? 'OK' : 'FAIL'}`
  );
  console.log(
    `Frontend:           ${results.frontendHealth?.accessible ? 'OK' : 'FAIL'}`
  );
  console.log(
    `Backend Tests:      ${results.backendTests ? 'PASS' : 'FAIL'}`
  );
  console.log(
    `Frontend E2E:       ${
      process.env.RUN_E2E === 'true'
        ? results.frontendTests
          ? 'PASS'
          : 'FAIL'
        : 'SKIPPED'
    }`
  );
  console.log(
    `Full Flow:          ${results.fullFlow?.success ? 'PASS' : 'FAIL'}`
  );
  console.log('');
  console.log(`Total Duration:     ${results.duration.toFixed(2)}s`);
  console.log('='.repeat(60));
  console.log('\n');

  const allPassed =
    results.backendHealth?.server &&
    results.databaseHealth?.cardsSearch &&
    results.databaseHealth?.metaTest &&
    results.frontendHealth?.accessible &&
    results.backendTests &&
    results.fullFlow?.success &&
    (process.env.RUN_E2E !== 'true' || results.frontendTests);

  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
