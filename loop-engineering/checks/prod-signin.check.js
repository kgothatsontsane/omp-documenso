const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') {
      consoleErrors.push(m.text());
    }
  });
  page.on('requestfailed', (r) => consoleErrors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

  const verdict = { pass: true, reasons: [] };
  try {
    await page.goto('https://agreements.open-mic.co.za/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    if (!/\/signin/.test(url)) {
      verdict.reasons.push(`expected /signin redirect, got ${url}`);
    }

    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    const cssLoaded = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => (l.sheet ? 'loaded' : 'blocked')),
    );
    if (stylesheets === 0) {
      verdict.reasons.push('no stylesheet link in DOM');
    }
    if (cssLoaded.includes('blocked')) {
      verdict.reasons.push('stylesheet blocked/not parsed');
    }

    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
    if (!bodyText.trim()) {
      verdict.reasons.push('page body is empty (white screen)');
    }

    const logoRoute = await page.evaluate(async () => {
      const r = await fetch('/static/omp_logo_b.png', { method: 'GET' });
      return { status: r.status, type: r.headers.get('content-type') };
    });
    if (logoRoute.status !== 200) {
      verdict.reasons.push(`custom logo route: HTTP ${logoRoute.status}`);
    }

    const failed = consoleErrors.filter((e) => !e.includes('net::ERR_CERT')).length;
    if (failed > 0) {
      verdict.reasons.push(`console/page errors: ${consoleErrors.slice(0, 5).join(' | ')}`);
    }
    if (verdict.reasons.length) {
      verdict.pass = false;
    }

    await page.screenshot({ path: 'checks/prod-signin.png', fullPage: true });
    console.log(
      JSON.stringify(
        {
          pass: verdict.pass,
          url,
          stylesheets,
          cssLoaded,
          bodyHead: bodyText.slice(0, 120),
          logoRoute,
          consoleErrors: consoleErrors.slice(0, 5),
          reasons: verdict.reasons,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.log(JSON.stringify({ pass: false, error: String(e).slice(0, 500) }, null, 2));
  }
  await browser.close();
})();
