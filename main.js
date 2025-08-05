import { Actor } from 'apify';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

await Actor.init();

const input = await Actor.getInput();
const { websites, category, sheetId, sheetName } = input;

if (!Array.isArray(websites) || websites.length === 0) {
    throw new Error('No websites provided or invalid format.');
}

const results = [];

for (const url of websites) {
    const page = await Actor.utils.puppeteer.openPageInNewContext();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000); // Wait for UI to render

        const screenshot = await page.screenshot({ fullPage: true });
        const screenshotBase64 = screenshot.toString('base64');

        const hasChatbot = await page.evaluate(() => {
            const selectors = [
                '[class*="chat"]',
                '[id*="chat"]',
                '[class*="bot"]',
                '[id*="bot"]'
            ];

            return selectors.some(selector => !!document.querySelector(selector));
        });

        results.push({
            website: url,
            category,
            chatbotDetected: hasChatbot ? 'Yes' : 'No',
            screenshot: `data:image/png;base64,${screenshotBase64}`
        });

        await page.close();
    } catch (err) {
        console.error(`Error processing ${url}:`, err);
        results.push({
            website: url,
            category,
            chatbotDetected: 'Error',
            screenshot: ''
        });
    }
}

// Authorize Google Sheets API
const auth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

const values = results.map(item => [
    item.website,
    item.category,
    item.chatbotDetected,
    item.screenshot
]);

await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
        values: [
            ['Website', 'Category', 'Chatbot Detected', 'Screenshot'],
            ...values,
        ],
    },
});

console.log('Done. Results saved to Google Sheets.');
await Actor.exit();
