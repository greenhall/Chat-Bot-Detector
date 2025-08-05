import { Actor } from 'apify';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

await Actor.init();

// your existing logic here, for example:
const input = await Actor.getInput();
const { websites, category, sheetId, sheetName } = input;

// loop through websites, detect chatbot, etc.

await Actor.exit();
