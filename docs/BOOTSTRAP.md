# Bootstrap the coordination workspace

This starter is prepared; remote GitHub setup is not complete until verified.

Preferred route: finish the requested GitHub sign-in, create the private repository, and use the connected GitHub tools to populate this workspace and create the Issues. Reuse the existing Figma file from WORKSPACE_LINKS.md.

Alternative for a machine already authenticated through the official GitHub CLI:

```bash
python scripts/setup_github.py
python scripts/setup_github.py --apply
```

The first command prints a plan without network mutations. The second verifies the account and private target, creates the repo if absent, creates/discovers a dashboard, Figma queue and seven task Issues, records actual IDs/URLs, and commits only files explicitly listed in coordination/bootstrap-files.json. It preserves unrelated Git trees and refuses an unrecognized populated repository. It does not overwrite an already-installed remote coordination workspace; use normal PRs for later changes.

Do not paste authentication credentials into chat. No secret configuration or application runtime data belongs in the bootstrap manifest.

After installation, inspect the Team progress Actions run and verify a posted progress report appears on the dashboard. Confirm all seven Issue links, dependencies, Figma URL, and collaborator access. If branch-protection rules are available, configure PR/check requirements without making the repo public. Report unenforced rules accurately.

Use verified teammate usernames to add only the intended collaborators with the necessary repository access. No invitation was sent by this local setup. Verify native Figma sharing separately using their correct Figma identities; do not make the file publicly editable.

Each agent starts from docs/prompts/agent-N.md plus its startup instruction file. Agent 3 uses its concise instructions and does not read all other feature prompts.
