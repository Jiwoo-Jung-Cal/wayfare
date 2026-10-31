import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('wayfare_setup', Path(__file__).resolve().parents[1]/'scripts/setup_github.py')
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class SetupSafetyTests(unittest.TestCase):
    def test_manifest_uploads_only_explicitly_listed_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'coordination').mkdir()
            (root/'README.md').write_text('Project')
            (root/'.env.local').write_text('DO_NOT_UPLOAD=example')
            (root/'coordination/bootstrap-files.json').write_text(json.dumps(['README.md']))
            with patch.object(setup, 'ROOT', root):
                self.assertEqual([p.name for p in setup.manifest()], ['README.md'])

    def test_manifest_rejects_parent_paths_and_environment_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'coordination').mkdir()
            (root/'.env.local').write_text('DO_NOT_UPLOAD=example')
            for forbidden in ['../outside.md', '.env.local']:
                (root/'coordination/bootstrap-files.json').write_text(json.dumps([forbidden]))
                with patch.object(setup, 'ROOT', root), self.assertRaises(setup.ApiError):
                    setup.manifest()

    def test_resuming_setup_does_not_duplicate_existing_task_issue(self):
        issue = {'number':7,'body':'<!-- wayfare-task:reroute -->\nExisting acceptance evidence'}
        with patch.object(setup, 'api') as api:
            result = setup.ensure_issue('example/wayfare', [issue], '<!-- wayfare-task:reroute -->', 'Title', 'Body')
            self.assertEqual(result, issue)
            api.assert_not_called()

    def test_new_issue_record_is_reused_in_the_same_setup_pass(self):
        issues = []
        created = {'number':7,'body':'<!-- wayfare-task:reroute -->\nBody'}
        with patch.object(setup, 'api', return_value=created) as api:
            setup.ensure_issue('example/wayfare', issues, '<!-- wayfare-task:reroute -->', 'Title', 'Body')
            setup.ensure_issue('example/wayfare', issues, '<!-- wayfare-task:reroute -->', 'Title', 'Body')
            self.assertEqual(api.call_count, 1)


if __name__ == '__main__':
    unittest.main()
