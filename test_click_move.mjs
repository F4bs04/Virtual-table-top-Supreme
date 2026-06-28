import { chromium } from 'playwright';
import path from 'path';

(async () => {
  console.log('Starting Playwright test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message));

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);

  // Take a screenshot of the lobby
  const lobbyPath = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/a577cc81-9065-4352-b266-99925f3e022e/scratch/lobby.png');
  await page.screenshot({ path: lobbyPath });
  console.log('Lobby screenshot saved to:', lobbyPath);

  // Click on "Jogar Solo (Offline / Local)"
  console.log('Clicking "Jogar Solo" button...');
  await page.click('button:has-text("Jogar Solo")');
  await page.waitForTimeout(3000);

  // Save a screenshot after entering room
  const roomPath = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/a577cc81-9065-4352-b266-99925f3e022e/scratch/room.png');
  await page.screenshot({ path: roomPath });
  console.log('Room screenshot saved to:', roomPath);

  // Print UI text
  const bodyText = await page.innerText('body');
  console.log('Body Text Snippet:', bodyText.substring(0, 500));

  // Let's try to select Ichigo Kurosaki token
  console.log('Selecting "Ichigo Kurosaki" via Sidebar...');
  const ichigoBtn = page.locator('span:has-text("Ichigo Kurosaki")');
  if (await ichigoBtn.count() > 0) {
    console.log('Found Ichigo in the sidebar. Clicking to select...');
    await ichigoBtn.first().click();
    await page.waitForTimeout(1000);

    const selectionPath = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/a577cc81-9065-4352-b266-99925f3e022e/scratch/ichigo_selected.png');
    await page.screenshot({ path: selectionPath });
    console.log('Selection screenshot saved.');

    // Click canvas center
    const canvas = page.locator('canvas');
    if (await canvas.count() > 0) {
      const box = await canvas.boundingBox();
      if (box) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        console.log(`Clicking near center: (${centerX}, ${centerY})`);
        await page.mouse.click(centerX, centerY);
        await page.waitForTimeout(1000);

        console.log(`Clicking adjacent: (${centerX + 40}, ${centerY})`);
        await page.mouse.click(centerX + 40, centerY);
        await page.waitForTimeout(2000);
      }
    }
  }

  // Final screenshot
  const finalPath = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/a577cc81-9065-4352-b266-99925f3e022e/scratch/final.png');
  await page.screenshot({ path: finalPath });
  console.log('Final screenshot saved.');

  await browser.close();
  console.log('Test finished.');
})();
