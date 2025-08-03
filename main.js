import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
console.log('Input received:', input);

const { urls, notifyMissing } = input;

const results = [];

const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: urls.length,
    requestHandler: async ({ request, $, enqueueLinks, log }) => {
        const bodyText = $('body').text().toLowerCase();
        const hasChatbot = bodyText.includes('chat') || bodyText.includes('bot');
        const screenshot = await Actor.takeScreenshot();

        results.push({
            url: request.url,
            hasChatbot,
            screenshotUrl: screenshot.url
        });

        if (notifyMissing && !hasChatbot) {
            await Actor.call('apify/send-mail', {
                to: 'your-email@example.com',
                subject: `No chatbot detected on ${request.url}`,
                text: `No chatbot interface was found on ${request.url}`,
            });
        }
    },
});

await crawler.run(urls);

await Actor.pushData(results);

await Actor.setValue('OUTPUT', results);
await Actor.exit();