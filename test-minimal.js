const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });
  
  await page.goto('file://' + __dirname + '/minimal-test.html');
  
  // Wait for initialization
  await page.waitForTimeout(2000);
  
  // Check for file inputs
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log(`Found ${fileInputs} file inputs on page`);
  
  // Try clicking the button
  await page.click('button:has-text("Open File Dialog")');
  
  await page.waitForTimeout(1000);
  
  await browser.close();
})();