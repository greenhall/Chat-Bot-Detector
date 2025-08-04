import Apify from 'apify';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

Apify.main(async () => {
    const input = await Apify.getInput();
    const { websites, category, sheetId, sheetName } = input;

    if (!Array.isArray(websites) || websites.length === 0) {
        throw new Error('No websites provided or invalid format.');
    }

    const results = [];

    for (const url of websites) {
        const page = await Apify.utils.puppeteer.openPageInNewContext();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait a bit for UI to render (adjust if needed)
            await page.waitForTimeout(5000);

            // Take screenshot
            const screenshot = await page.screenshot({ fullPage: true });
            const screenshotBase64 = screenshot.toString('base64');

            // Basic chatbot detection
            const hasChatbot = await page.evaluate(() => {
                const selectors = [
                    '[class*="chat"]',
                    '[id*="chat"]',
                    '[class*="bot"]',
                    '[id*="bot"]',
                    '[class*="intercom"]',
                    '[class*="drift"]',
                    '[class*="livechat"]',
                    '[class*="messenger"]'
                ];
                return selectors.some(sel => {
                    const el = document.querySelector(sel);
                    return el && el.offsetHeight > 0 && el.offsetWidth > 0;
                });
            });

            results.push({
                website: url,
                category,
                chatbotDetected: hasChatbot ? 'Yes' : 'No',
                screenshot: `data:image/png;base64,${screenshotBase64}`
            });

            await page.close();
        } catch (error) {
            results.push({
                website: url,
                category,
                chatbotDetected: 'Error',
                screenshot: 'N/A',
                error: error.message
            });
            await page.close();
        }
    }

    // Save results to default dataset (optional)
    await Apify.pushData(results);

    // Upload to Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');

    const auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
});
