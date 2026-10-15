"""Exercise the real publisher against temporary Git remotes, without credentials."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/publish-wiki.sh"


class WikiPublisherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "Home.md").write_text("# Campus Compass\n")
        self.remote = self.root / "wiki.git"
        self.env = dict(os.environ)
        self.env.pop("WIKI_TOKEN", None)
        self.env.update(
            WIKI_REMOTE_URL=self.remote.as_uri(),
            RUNNER_TEMP=str(self.root),
            SOURCE_SHA="test-source",
            GIT_AUTHOR_NAME="Wiki test",
            GIT_AUTHOR_EMAIL="test@example.invalid",
            GIT_COMMITTER_NAME="Wiki test",
            GIT_COMMITTER_EMAIL="test@example.invalid",
            GIT_CONFIG_COUNT="1",
            GIT_CONFIG_KEY_0="commit.gpgsign",
            GIT_CONFIG_VALUE_0="false",
        )

    def git(self, *args):
        return subprocess.run(
            ["git", *map(str, args)], env=self.env, text=True,
            capture_output=True, check=True,
        ).stdout.strip()

    def seed(self, branch="master"):
        self.git("init", "--bare", "--initial-branch", branch, self.remote)
        seed = self.root / "seed"
        self.git("clone", self.remote, seed)
        (seed / "Home.md").write_text("Original home\n")
        (seed / "Manual.md").write_text("Keep this manual page\n")
        self.git("-C", seed, "add", ".")
        self.git("-C", seed, "commit", "-m", "Initialize wiki")
        self.git("-C", seed, "push", "origin", branch)

    def publish(self, success=True):
        result = subprocess.run(
            ["bash", str(SCRIPT), str(self.source)], env=self.env,
            text=True, capture_output=True,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        self.assertEqual(list(self.root.glob("campus-wiki.*")), [])
        return result

    def read(self, page):
        return self.git("--git-dir", self.remote, "show", f"HEAD:{page}")

    def head(self):
        return self.git("--git-dir", self.remote, "rev-parse", "HEAD")

    def test_updates_preserves_and_skips_unchanged(self):
        self.seed()
        (self.source / "Getting-Started.md").write_text("Demo steps\n")
        self.publish()
        self.assertEqual(self.read("Home.md"), "# Campus Compass")
        self.assertEqual(self.read("Getting-Started.md"), "Demo steps")
        self.assertEqual(self.read("Manual.md"), "Keep this manual page")
        first = self.head()
        self.assertIn("no commit needed", self.publish().stdout)
        self.assertEqual(self.head(), first)
        (self.source / "Getting-Started.md").unlink()
        self.publish()
        self.assertEqual(self.read("Getting-Started.md"), "Demo steps")
        self.assertEqual(self.head(), first)

    def test_discovers_main_as_wiki_default_branch(self):
        self.seed("main")
        self.publish()
        self.assertEqual(self.read("Home.md"), "# Campus Compass")

    def test_requires_nonempty_home(self):
        for content in (None, ""):
            with self.subTest(content=content):
                home = self.source / "Home.md"
                if content is None:
                    home.unlink()
                else:
                    home.write_text(content)
                self.assertIn("non-empty Home.md", self.publish(False).stderr)

    def test_rejects_symlinks_and_git_metadata(self):
        link = self.source / "Linked.md"
        link.symlink_to(self.source / "Home.md")
        self.assertIn("symbolic links", self.publish(False).stderr)
        link.unlink()
        (self.source / ".git").mkdir()
        self.assertIn("Git metadata", self.publish(False).stderr)

    def test_uninitialized_remote_has_actionable_error(self):
        self.assertIn("Create its first page", self.publish(False).stderr)


if __name__ == "__main__":
    unittest.main()
