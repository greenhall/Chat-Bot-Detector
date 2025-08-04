import { Actor } from 'apify';
import { Dataset } from 'apify';
import { chromium } from 'playwright';
import fs from 'fs/promises';

await Actor.init();

const input = await Actor.getInput();
const { websites, category, sheetId, sheetName } = input;

if (!websites || !Array.isArray(websites) || websites.length === 0) {
    throw new Error('Input "websites" must be a non-empty array of URLs.');
}
if (!sheetId) throw new Error('Missing "sheetId" in input.');
if (!sheetName) throw new Error('Missing "sheetName" in input.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const results = [];

for (const url of websites) {
    let chatbotDetected = false;
    let screenshotUrl = null;

    try {
        const response = await page.goto(url, { timeout: 30000 });
        await page.waitForTimeout(5000); // wait for possible chat widgets to load

        // Check for visible chatbot UI
        chatbotDetected = await page.evaluate(() => {
            const selectors = ['iframe', '[class*=chat]', '[id*=chat]', '[class*=bot]', '[id*=bot]'];
            return selectors.some(selector => {
                const el = document.querySelector(selector);
                return el && window.getComputedStyle(el).display !== 'none';
            });
        });

        const screenshotName = `screenshot-${Date.now()}.png`;
        const screenshotPath = `./${screenshotName}`;
        await page.screenshot({ path: screenshotPath });

        // Upload screenshot to Apify Storage and get public URL
        const storage = await Actor.apifyClient.keyValueStores();
        const defaultStore = await storage.getOrCreate({ name: 'default' });
        await defaultStore.setRecord({
            key: screenshotName,
            value: await fs.readFile(screenshotPath),
            contentType: 'image/png',
        });
        screenshotUrl = `https://api.apify.com/v2/key-value-stores/${defaultStore.id}/records/${screenshotName}`;
    } catch (error) {
        console.error(`Error processing ${url}: ${error.message}`);
    }

    results.push({
        url,
        category,
        chatbotDetected,
        screenshotUrl,
        checkedAt: new Date().toISOString(),
    });
}

await browser.close();

// Push results to dataset for Apify dashboard view
await Dataset.pushData(results);

// Push to Google Sheet
await Actor.call('apify/send-to-google-sheets', {
    spreadsheetId: sheetId,
    sheetName,
    data: results,
}, {
    memoryMbytes: 4096,
});

await Actor.exit();
