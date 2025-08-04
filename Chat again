import { Actor, Dataset } from 'apify';
import { chromium } from 'playwright';
import fs from 'fs/promises';

await Actor.init();

const input = await Actor.getInput();
const { websites, category, sheetId, sheetName } = input;

if (!websites || !Array.isArray(websites) || websites.length === 0) {
    throw new Error('Input "websites" must be a non-empty array of URLs.');
}
if (!sheetId) throw new Error("Missing 'sheetId' in input.");
if (!sheetName) throw new Error("Missing 'sheetName' in input.");

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const results = [];

for (const url of websites) {
    console.log(`Checking: ${url}`);
    try {
        await page.goto(url, { timeout: 15000 });
        await page.waitForTimeout(4000);

        const content = await page.content();
        const hasChatbot = /chat|bot|drift|intercom|tawk|zendesk|livechat|messenger|crisp|olark/i.test(content);

        results.push({
            url,
            hasChatbot,
            timestamp: new Date().toISOString(),
            category,
        });

    } catch (error) {
        results.push({
            url,
            hasChatbot: false,
            error: error.message,
            category,
        });
    }
}

await Dataset.pushData(results);
await browser.close();
await Actor.exit();
