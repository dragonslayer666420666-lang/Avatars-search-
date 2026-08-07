import fs from 'node:fs';

const requestPath = '.construction-bot/request.txt';
const planPath = '.construction-bot/plan.json';
const indexPath = 'index.html';

const token = process.env.GITHUB_TOKEN || '';
const model = process.env.MODEL_ID || 'openai/gpt-4.1';

if (!token) {
  throw new Error('GITHUB_TOKEN is missing.');
}

if (!fs.existsSync(requestPath)) {
  throw new Error(`${requestPath} is missing.`);
}

if (!fs.existsSync(indexPath)) {
  throw new Error('index.html was not found.');
}

const request = fs.readFileSync(requestPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

const system = `
You are the Avatar Search Construction Bot.

Produce a minimal, reviewable exact-replacement plan for index.html.

Rules:
- Preserve unrelated features.
- Never add secrets, credentials, analytics, tracking, hidden downloads, remote control, eval, new Function, document.write, or obfuscated code.
- Keep Android Chrome and phone use working.
- Do not auto-merge.
- Return JSON only.
`.trim();

const user = `
APPROVED REQUEST

${request}

CURRENT index.html

${index}

Return exactly this JSON shape:

{
  "summary": "short summary",
  "operations": [
    {
      "find": "exact existing text copied from index.html",
      "replace": "replacement text",
      "expectedMatches": 1
    }
  ],
  "manualChecks": ["short check"]
}

Rules:
- Use at most 24 operations.
- Each find value must be exact text from index.html.
- Prefer unique replacements.
- If the request cannot be done safely, return an empty operations array and explain why in summary.
`.trim();

const response = await fetch(
  'https://models.github.ai/inference/chat/completions',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2,
      max_tokens: 5000
    })
  }
);

const data = await response.json().catch(() => ({}));

if (!response.ok) {
  throw new Error(
    data?.error?.message ||
    data?.message ||
    `GitHub Models request failed: ${response.status}`
  );
}

let content = String(
  data?.choices?.[0]?.message?.content || ''
).trim();

content = content
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/```\s*$/i, '')
  .trim();

let plan;

try {
  plan = JSON.parse(content);
} catch (error) {
  throw new Error(
    `GitHub Models returned invalid JSON: ${error.message}`
  );
}

if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
  throw new Error('Plan must be a JSON object.');
}

if (typeof plan.summary !== 'string' || !plan.summary.trim()) {
  throw new Error('Plan summary is missing.');
}

if (!Array.isArray(plan.operations)) {
  throw new Error('Plan operations must be an array.');
}

if (plan.operations.length === 0) {
  throw new Error(`No safe patch was generated: ${plan.summary}`);
}

if (plan.operations.length > 24) {
  throw new Error('Plan contains more than 24 operations.');
}

fs.mkdirSync('.construction-bot', { recursive: true });

fs.writeFileSync(
  planPath,
  JSON.stringify(plan, null, 2),
  'utf8'
);

console.log('Generated Construction Bot plan.');
