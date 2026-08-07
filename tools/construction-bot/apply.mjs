import fs from 'node:fs';

const planPath = '.construction-bot/plan.json';
const indexPath = 'index.html';

if (!fs.existsSync(planPath)) {
  throw new Error(`${planPath} is missing.`);
}

if (!fs.existsSync(indexPath)) {
  throw new Error(`${indexPath} is missing.`);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
let text = fs.readFileSync(indexPath, 'utf8');

const report = [
  '# Construction Bot change report',
  '',
  plan.summary || 'No summary.',
  '',
  '## Applied operations'
];

for (const [i, op] of plan.operations.entries()) {
  const parts = text.split(op.find);
  const count = parts.length - 1;

  if (count !== op.expectedMatches) {
    throw new Error(
      `Operation ${i + 1}: expected ${op.expectedMatches} match(es), found ${count}.`
    );
  }

  text = parts.join(op.replace);

  report.push(
    `- Operation ${i + 1}: replaced ${count} exact match(es).`
  );
}

fs.writeFileSync(indexPath, text, 'utf8');

report.push('', '## Manual checks');

for (const item of plan.manualChecks || []) {
  report.push(`- ${item}`);
}

report.push(
  '',
  'Nothing was merged automatically. Review Files changed and Checks before merging.',
  ''
);

fs.writeFileSync(
  '.construction-bot/change-report.md',
  report.join('\n'),
  'utf8'
);

console.log('Applied Construction Bot plan.');
