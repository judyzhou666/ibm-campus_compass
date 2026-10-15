import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
function fixture(t, branch = "master") {
  const root = mkdtempSync(join(tmpdir(), "campus-wiki-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source"),
    remote = join(root, "wiki.git"),
    seed = join(root, "seed");
  mkdirSync(source);
  writeFileSync(join(source, "Home.md"), "# Campus Compass\n");
  const env = {
    ...process.env,
    WIKI_REMOTE_URL: pathToFileURL(remote).href,
    RUNNER_TEMP: root,
    SOURCE_SHA: "test-source",
    GIT_AUTHOR_NAME: "Wiki test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Wiki test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "commit.gpgsign",
    GIT_CONFIG_VALUE_0: "false",
  };
  delete env.WIKI_TOKEN;
  function git(...args) {
    const r = spawnSync("git", args, { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  }
  function publish(ok = true) {
    const r = spawnSync("bash", [resolve("scripts/publish-wiki.sh"), source], {
      env,
      encoding: "utf8",
    });
    if (ok) assert.equal(r.status, 0, r.stderr);
    else assert.notEqual(r.status, 0);
    assert.deepEqual(
      readdirSync(root).filter((x) => x.startsWith("campus-wiki.")),
      [],
    );
    return r;
  }
  function init() {
    git("init", "--bare", "--initial-branch", branch, remote);
    git("clone", remote, seed);
    writeFileSync(join(seed, "Home.md"), "Original home\n");
    writeFileSync(join(seed, "Manual.md"), "Keep this manual page\n");
    git("-C", seed, "add", ".");
    git("-C", seed, "commit", "-m", "Initialize wiki");
    git("-C", seed, "push", "origin", branch);
  }
  return {
    source,
    git,
    publish,
    init,
    read: (page) => git("--git-dir", remote, "show", `HEAD:${page}`),
    head: () => git("--git-dir", remote, "rev-parse", "HEAD"),
  };
}
test("updates, preserves manual pages, and skips unchanged/removed sources", (t) => {
  const f = fixture(t);
  f.init();
  writeFileSync(join(f.source, "Getting-Started.md"), "Demo steps\n");
  f.publish();
  assert.equal(f.read("Home.md"), "# Campus Compass");
  assert.equal(f.read("Manual.md"), "Keep this manual page");
  const head = f.head();
  assert.match(f.publish().stdout, /no commit needed/);
  assert.equal(f.head(), head);
  unlinkSync(join(f.source, "Getting-Started.md"));
  f.publish();
  assert.equal(f.read("Getting-Started.md"), "Demo steps");
  assert.equal(f.head(), head);
});
test("discovers main as default branch", (t) => {
  const f = fixture(t, "main");
  f.init();
  f.publish();
  assert.equal(f.read("Home.md"), "# Campus Compass");
});
test("requires a nonempty Home page", (t) => {
  const f = fixture(t);
  unlinkSync(join(f.source, "Home.md"));
  assert.match(f.publish(false).stderr, /non-empty Home.md/);
  writeFileSync(join(f.source, "Home.md"), "");
  assert.match(f.publish(false).stderr, /non-empty Home.md/);
});
test("rejects symlinks and Git metadata", (t) => {
  const f = fixture(t);
  const link = join(f.source, "Linked.md");
  symlinkSync(join(f.source, "Home.md"), link);
  assert.match(f.publish(false).stderr, /symbolic links/);
  unlinkSync(link);
  mkdirSync(join(f.source, ".git"));
  assert.match(f.publish(false).stderr, /Git metadata/);
});
test("missing remote has an actionable error", (t) => {
  const f = fixture(t);
  assert.match(f.publish(false).stderr, /Create its first page/);
});
