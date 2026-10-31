#!/usr/bin/env python3
"""Post one bounded progress report using the user's existing GitHub CLI auth."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', required=True)
    parser.add_argument('--status', required=True, choices=['ready', 'in_progress', 'blocked', 'review', 'done'])
    parser.add_argument('--summary', required=True)
    parser.add_argument('--next', dest='next_step', default='')
    parser.add_argument('--blocker', default='')
    parser.add_argument('--branch', default='')
    parser.add_argument('--commit', default='')
    parser.add_argument('--pr', default='')
    parser.add_argument('--figma', default='')
    parser.add_argument('--design-revision', default='')
    parser.add_argument('--checks', default='')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    config = json.loads((root / 'coordination/config.json').read_text())
    tasks = json.loads((root / 'coordination/tasks.json').read_text())
    task = next((value for value in tasks if value['key'] == args.task), None)
    if not task:
        parser.error('Unknown task key; see coordination/tasks.json')
    value = dict(agent=task['agent'], task=args.task, status=args.status, summary=args.summary,
                 next=args.next_step, blocker=args.blocker, branch=args.branch, commit=args.commit,
                 pr=args.pr, figma=args.figma, design_revision=args.design_revision, checks=args.checks)
    body = '<!-- wayfare-progress -->\n```json\n' + json.dumps(value, indent=2) + '\n```'
    if args.dry_run:
        print(body)
        return 0
    issue = config.get('taskIssues', {}).get(args.task)
    if not config.get('repository') or not issue:
        parser.error('Remote setup is incomplete; no verified repository/Issue configured')
    if not shutil.which('gh'):
        parser.error('GitHub CLI is unavailable. Post the --dry-run body through your connected GitHub tool.')
    subprocess.run(['gh', 'api', f"repos/{config['repository']}/issues/{issue}/comments", '--method', 'POST', '--input', '-'], input=json.dumps({'body': body}), text=True, check=True, stdout=subprocess.DEVNULL)
    print(f"Progress posted to {config['repository']}#{issue}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
