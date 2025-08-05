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
    console.log(`[PAGE ERROR STACK] ${error.stack}`);
  });
  
  console.log('Loading dist/index.html...');
  await page.goto('file://' + __dirname + '/dist/index.html');
  
  console.log('Waiting for page to load...');
  await page.waitForTimeout(3000);
  
  console.log('Checking for file inputs...');
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log(`Found ${fileInputs} file inputs on page`);
  
  if (fileInputs === 0) {
    console.log('No file inputs found, checking if button exists...');
    const button = await page.locator('button:has-text("Choose Files")').count();
    console.log(`Found ${button} file upload buttons`);
    
    if (button > 0) {
      console.log('Clicking file upload button...');
      await page.click('button:has-text("Choose Files")');
      await page.waitForTimeout(1000);
      
      const fileInputsAfterClick = await page.locator('input[type="file"]').count();
      console.log(`Found ${fileInputsAfterClick} file inputs after button click`);
    }
  }
  
  await browser.close();
})();