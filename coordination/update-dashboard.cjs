'use strict';

const fs = require('node:fs');
const path = require('node:path');
const MARKER = '<!-- wayfare-dashboard -->';
const STATES = new Set(['ready', 'in_progress', 'blocked', 'review', 'done']);

function text(value, limit = 180) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[|<>`\[\]\\]/g, ' ').trim().slice(0, limit);
}

function parseProgress(body, agent) {
  if (typeof body !== 'string' || !body.includes('<!-- wayfare-progress -->')) return null;
  const match = body.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    if (!value || value.agent !== agent || !STATES.has(value.status)) return null;
    return value;
  } catch { return null; }
}

function stateFor(task, issue, latest, issues, prs) {
  if (!issue) return 'Not created';
  if (issue.state === 'closed') return 'Done';
  if (task.dependsOn.some(key => !issues[key] || issues[key].state !== 'closed')) return 'Blocked';
  if (prs.some(pr => pr.state === 'open' && !pr.draft)) return 'Review';
  if (latest?.status === 'done') return 'Review (issue still open)';
  const names = { ready: 'Ready', in_progress: 'In progress', blocked: 'Blocked', review: 'Review' };
  return names[latest?.status] || (prs.some(pr => pr.state === 'open') ? 'In progress' : 'Ready');
}

function render(tasks, issues, reports, prs, config, now) {
  const lines = [MARKER, '# WayFare — team progress', '',
    'Updated from GitHub Issues, agent progress reports, and pull requests. Code is shared through branches/PRs; editable screens remain in Figma.', '',
    '| Task | Owner / budget | State | Latest progress | Next step / blocker | PR |',
    '| --- | --- | --- | --- | --- | --- |'];
  for (const task of tasks) {
    const issue = issues[task.key], report = reports[task.key];
    const linked = prs.filter(pr => typeof pr.body === 'string' && pr.body.includes(`<!-- wayfare-task:${task.key} -->`));
    const cell = issue ? `[#${issue.number}](${issue.html_url}) ${text(task.title)}` : text(task.title);
    const links = linked.slice(0, 3).map(pr => `[#${pr.number}](${pr.html_url})${pr.merged_at ? ' merged' : pr.draft ? ' draft' : ''}`).join(', ') || '—';
    lines.push(`| ${cell} | Agent ${task.agent} · ${text(task.human)} · ${task.budget} | ${stateFor(task, issue, report?.value, issues, linked)} | ${text(report?.value.summary) || 'No report yet'} | ${text(report?.value.blocker || report?.value.next) || 'See task acceptance criteria'} | ${links} |`);
  }
  const completed = tasks.filter(task => issues[task.key]?.state === 'closed').length;
  lines.push('', `${completed}/${tasks.length} task Issues closed. “Done” requires a closed Issue; an agent report alone does not close it.`, '',
    '## Shared links', '',
    `- Repository: https://github.com/${config.repository}`,
    config.primaryFigmaUrl ? `- Figma Design: ${config.primaryFigmaUrl}` : '- Figma Design: not linked',
    config.figmaQueueIssue ? `- Figma writer queue: https://github.com/${config.repository}/issues/${config.figmaQueueIssue}` : '- Figma writer queue: not created',
    '- Editable Figma and implementation mapping: docs/DESIGN_MAP.md in the repository.', '',
    '## Update rule', '',
    'Every agent reports at session start, before pausing/handing off, when blocked, and after a commit/PR milestone. Include work completed, next step, branch/commit/PR, verification, Figma links, and dependencies. Do not post secrets or full chats.', '',
    'This workflow refreshes shared status without LLM calls. It does not wake inactive chatbots. Latest report details remain in the task Issue comments.', '',
    `Last dashboard refresh: ${now.toISOString()}`);
  return lines.join('\n');
}

async function main({ github, context, core }) {
  const base = path.resolve(__dirname);
  const tasks = JSON.parse(fs.readFileSync(path.join(base, 'tasks.json'), 'utf8'));
  const config = JSON.parse(fs.readFileSync(path.join(base, 'config.json'), 'utf8'));
  config.repository = `${context.repo.owner}/${context.repo.repo}`;
  const params = { ...context.repo, state: 'all', per_page: 100 };
  const all = await github.paginate(github.rest.issues.listForRepo, params);
  const issues = {};
  for (const issue of all.filter(value => !value.pull_request)) {
    const match = issue.body?.match(/<!-- wayfare-task:([a-z0-9-]+) -->/);
    if (match && !issues[match[1]]) issues[match[1]] = issue;
  }
  const reports = {};
  for (const task of tasks) {
    if (!issues[task.key]) continue;
    const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: issues[task.key].number, per_page: 100 });
    for (const comment of comments.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))) {
      const value = parseProgress(comment.body, task.agent);
      if (value) reports[task.key] = { value, url: comment.html_url };
    }
  }
  const prs = await github.paginate(github.rest.pulls.list, params);
  const body = render(tasks, issues, reports, prs, config, new Date());
  const dashboard = all.find(issue => !issue.pull_request && issue.body?.includes(MARKER));
  const result = dashboard
    ? await github.rest.issues.update({ ...context.repo, issue_number: dashboard.number, body })
    : await github.rest.issues.create({ ...context.repo, title: 'WayFare — team progress', body });
  core.info(`Updated progress dashboard #${result.data.number}`);
  return result.data;
}

module.exports = { parseProgress, stateFor, render, text, main };
