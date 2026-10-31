'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProgress, stateFor, render, text } = require('./update-dashboard.cjs');
const report = value => `<!-- wayfare-progress -->\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
test('malformed, unmarked, wrong-owner and unknown-status updates are ignored', () => {
  assert.equal(parseProgress('plain text', 4), null);
  assert.equal(parseProgress('<!-- wayfare-progress -->\n```json\n{\n```', 4), null);
  assert.equal(parseProgress(report({ agent: 5, status: 'ready' }), 4), null);
  assert.equal(parseProgress(report({ agent: 4, status: 'invented' }), 4), null);
  assert.equal(parseProgress(report({ agent: 4, status: 'blocked', summary: 'Need policy schema' }), 4).summary, 'Need policy schema');
});
test('unmet dependencies block a task even when a chatbot claims completion', () => {
  const task = { dependsOn: ['foundation'] };
  assert.equal(stateFor(task, { state: 'open' }, { status: 'done' }, {}, []), 'Blocked');
  assert.equal(stateFor(task, { state: 'open' }, { status: 'done' }, { foundation: { state: 'closed' } }, []), 'Review (issue still open)');
});
test('GitHub completion and PR review take precedence over an earlier agent report', () => {
  const task = { dependsOn: [] };
  assert.equal(stateFor(task, { state: 'closed' }, { status: 'blocked' }, {}, []), 'Done');
  assert.equal(stateFor(task, { state: 'open' }, { status: 'in_progress' }, {}, [{ state: 'open', draft: false }]), 'Review');
});
test('report content cannot inject table rows or HTML into the dashboard', () => {
  const sanitized = text('|fake|\n<script>alert(1)</script>');
  assert(!sanitized.includes('|'));
  assert(!sanitized.includes('\n'));
  assert(!sanitized.includes('<'));
  assert.equal(text('x'.repeat(1000)).length, 180);
});
test('dashboard distinguishes reported completion from closed issues and shows missing tasks', () => {
  const tasks = [{ key: 'reroute', title: 'Recovery', agent: 4, human: 'Kelvin', budget: 'Moderate', dependsOn: [] }, { key: 'wallet', title: 'Wallet', agent: 5, human: 'Brian', budget: 'Moderate', dependsOn: [] }];
  const body = render(tasks, { reroute: { number: 5, html_url: 'https://github.com/example/wayfare/issues/5', state: 'open' } }, { reroute: { value: { status: 'done', summary: 'Ready for review' } } }, [], { repository: 'example/wayfare' }, new Date('2026-10-31T20:00:00Z'));
  assert(body.includes('Review (issue still open)'));
  assert(body.includes('Not created'));
  assert(body.includes('0/2 task Issues closed'));
});
