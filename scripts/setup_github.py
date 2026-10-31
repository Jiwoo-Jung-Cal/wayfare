#!/usr/bin/env python3
"""Idempotent GitHub coordination setup using existing GitHub CLI authentication.

Without --apply this prints a plan and makes no network writes.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


class ApiError(RuntimeError):
    pass


def api(endpoint, method='GET', data=None, missing_ok=False):
    command = ['gh', 'api', endpoint, '--method', method]
    if data is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=None if data is None else json.dumps(data), text=True, capture_output=True)
    if result.returncode:
        if missing_ok and 'HTTP 404' in result.stderr:
            return None
        raise ApiError(result.stderr.strip() or f'GitHub request failed: {endpoint}')
    return json.loads(result.stdout) if result.stdout.strip() else None


def all_issues(repo):
    values = []
    page = 1
    while True:
        batch = api(f'repos/{repo}/issues?state=all&per_page=100&page={page}')
        values.extend(value for value in batch if 'pull_request' not in value)
        if len(batch) < 100:
            return values
        page += 1


def ensure_issue(repo, issues, marker, title, body, labels=None):
    found = next((value for value in issues if marker in (value.get('body') or '')), None)
    if found:
        return found
    result = api(f'repos/{repo}/issues', 'POST', dict(title=title, body=marker+'\n'+body, labels=labels or []))
    issues.append(result)
    return result


def manifest():
    names = json.loads((ROOT/'coordination/bootstrap-files.json').read_text())
    files = []
    for name in names:
        relative = Path(name)
        target = (ROOT/relative).resolve()
        if relative.is_absolute() or '..' in relative.parts or not target.is_relative_to(ROOT.resolve()):
            raise ApiError('Unsafe bootstrap manifest path')
        if any(part.startswith('.env') or part in {'.git', '__pycache__', 'node_modules'} for part in relative.parts):
            raise ApiError('Configuration secrets and dependency folders cannot enter the bootstrap manifest')
        if not target.is_file():
            raise ApiError(f'Missing bootstrap file: {name}')
        target.read_text(encoding='utf-8')
        files.append(target)
    return files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Create/update the coordination workspace')
    args = parser.parse_args()
    config_path = ROOT/'coordination/config.json'
    config = json.loads(config_path.read_text())
    tasks = json.loads((ROOT/'coordination/tasks.json').read_text())
    files = manifest()
    repo = config.get('repository') or f"{config['intendedOwner']}/{config['repositoryName']}"
    if not args.apply:
        print(json.dumps({'mode':'plan only','repository':repo,'visibility':'private','files':len(files),'task_issues':[t['key'] for t in tasks],'dashboard':True,'figma_queue':True,'collaborator_invites':'not sent; verified handles required'}, indent=2))
        return 0
    if not shutil.which('gh'):
        parser.error('GitHub CLI is not installed. Use the connected GitHub tools or install the official CLI; no login secrets belong in chat.')
    user = api('user')
    metadata = api(f'repos/{repo}', missing_ok=True)
    if metadata is None:
        if user['login'].lower() != config['intendedOwner'].lower():
            parser.error('Authenticated account does not match the intended owner; refusing to create a repository in the wrong account')
        subprocess.run(['gh', 'repo', 'create', repo, '--private', '--add-readme', '--description', 'WayFare: shared Figma-first build and five-agent coordination'], check=True)
        metadata = api(f'repos/{repo}')
    if not metadata.get('private'):
        parser.error('The target is not private; this script will not change visibility or publish project files')
    existing = api(f'repos/{repo}/contents/coordination/config.json', missing_ok=True)
    if existing is not None:
        print(json.dumps({'repository':metadata['html_url'],'status':'Coordination is already installed; existing remote files were preserved. Use a reviewed PR for updates.'}, indent=2))
        return 0
    if existing is None:
        listing = api(f'repos/{repo}/contents')
        names = {value['name'] for value in listing}
        if names - {'README.md', 'LICENSE', '.gitignore'}:
            parser.error('Existing unrecognized content found. Use a reviewed integration PR instead of overwriting coordination paths')
    config['repository'] = metadata['full_name']
    repo = config['repository']
    default = metadata['default_branch']
    workflow = ROOT/'.github/workflows/team-progress.yml'
    workflow.write_text(workflow.read_text().replace('branches: [main]', 'branches: ['+json.dumps(default)+']'))
    for label, color in [('wayfare-task', '0969da'), ('coordination', '5319e7')]:
        if api(f'repos/{repo}/labels/{label}', missing_ok=True) is None:
            api(f'repos/{repo}/labels', 'POST', {'name':label,'color':color})
    issues = all_issues(repo)
    dashboard = ensure_issue(repo, issues, '<!-- wayfare-dashboard -->', 'WayFare — team progress', '# Team progress\n\nThe automatic dashboard refreshes after the workflow is committed. Setup alone is not proof that the workflow has run.', ['coordination'])
    queue = ensure_issue(repo, issues, '<!-- wayfare-figma-queue -->', 'Figma writer queue — one active writer', (ROOT/'docs/templates/COORDINATION_ISSUE.md').read_text(), ['coordination'])
    config['dashboardIssue'] = dashboard['number']
    config['figmaQueueIssue'] = queue['number']
    config['taskIssues'] = {}
    records = {}
    for task in tasks:
        marker = f"<!-- wayfare-task:{task['key']} -->"
        record = ensure_issue(repo, issues, marker, f"Agent {task['agent']} / {task['human']}: {task['title']}", (ROOT/task['seed']).read_text(), ['wayfare-task'])
        config['taskIssues'][task['key']] = record['number']
        records[task['key']] = record
    for task in tasks:
        deps = ', '.join(f"#{config['taskIssues'][key]}" for key in task['dependsOn']) or 'None'
        body = f"<!-- wayfare-task:{task['key']} -->\n"+(ROOT/task['seed']).read_text()+f"\n## Live coordination links\n\nDependencies: {deps}\nDashboard: #{dashboard['number']}\nFigma writer queue: #{queue['number']}\n\nPost structured progress comments with scripts/report_progress.py. Link completion PRs with the task marker and Closes #{records[task['key']]['number']}.\n"
        if records[task['key']].get('body') != body:
            api(f"repos/{repo}/issues/{records[task['key']]['number']}", 'PATCH', {'body':body})
    config['setupStatus'] = 'repository and issues created; workflow activation/verification pending'
    config_path.write_text(json.dumps(config, indent=2)+'\n')
    links = ['# Live workspace links','',f"- Repository: {metadata['html_url']}",f"- Dashboard: {dashboard['html_url']}",f"- Figma writer queue: {queue['html_url']}",f"- Figma Design: {config.get('primaryFigmaUrl') or 'pending'}",'', '| Task | Issue |','| --- | --- |']
    links += [f"| {task['key']} | {records[task['key']]['html_url']} |" for task in tasks]
    (ROOT/'docs/WORKSPACE_LINKS.md').write_text('\n'.join(links)+'\n')
    readme = ROOT/'README.md'
    text = readme.read_text()
    text = text.split('<!-- wayfare-live-links -->')[0].rstrip()+f"\n\n<!-- wayfare-live-links -->\n## Live team progress\n\n[Dashboard]({dashboard['html_url']}) · [Figma queue]({queue['html_url']}) · [Workspace links](docs/WORKSPACE_LINKS.md)\n"
    readme.write_text(text)
    head = api(f'repos/{repo}/git/ref/heads/{default}')['object']['sha']
    base_tree = api(f'repos/{repo}/git/commits/{head}')['tree']['sha']
    entries = [{'path':str(p.relative_to(ROOT)).replace('\\','/'),'mode':'100644','type':'blob','content':p.read_text(encoding='utf-8')} for p in manifest()]
    tree = api(f'repos/{repo}/git/trees', 'POST', {'base_tree':base_tree,'tree':entries})
    commit = api(f'repos/{repo}/git/commits', 'POST', {'message':'Set up shared WayFare coordination, progress dashboard and agent instructions','tree':tree['sha'],'parents':[head]})
    api(f'repos/{repo}/git/refs/heads/{default}', 'PATCH', {'sha':commit['sha'],'force':False})
    print(json.dumps({'repository':metadata['html_url'],'dashboard':dashboard['html_url'],'figma_queue':queue['html_url'],'tasks':{key:value['html_url'] for key,value in records.items()},'commit':commit['sha'],'workflow':'committed; inspect Actions and dashboard before claiming a live successful refresh','collaborators':'not invited; verified handles are still required'}, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ApiError, subprocess.CalledProcessError) as exc:
        print(f'Setup stopped: {exc}. Existing Issues are discovered on rerun; do not create duplicates.', file=sys.stderr)
        sys.exit(1)
