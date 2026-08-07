import fs from 'node:fs';

const eventName = process.env.EVENT_NAME || '';
const manual = (process.env.MANUAL_REQUEST || '').trim();
const issueTitle = (process.env.ISSUE_TITLE || '').trim();
const issueBody = (process.env.ISSUE_BODY || '').trim();

let request = '';

if (eventName === 'workflow_dispatch') {
  request = manual;
} else {
  request = `${issueTitle}\n\n${issueBody}`.trim();
}

if (!request) {
  throw new Error('Construction Bot request is empty.');
}

if (request.length > 20000) {
  throw new Error('Construction Bot request is too large.');
}

fs.mkdirSync('.construction-bot', { recursive: true });

fs.writeFileSync(
  '.construction-bot/request.txt',
  request + '\n',
  'utf8'
);

console.log('Captured Construction Bot request.');
