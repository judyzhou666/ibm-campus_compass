# Publishing the GitHub Wiki

Source pages are in `wiki/`; `.github/workflows/publish-wiki.yml` publishes them to the separate `ibm-campus_compass.wiki.git` repository. The workflow uses the requested `actions/checkout` v5.0.0 commit pin.

## One-time setup

1. Enable Wikis in repository settings and create an initial Home page through the Wiki tab. This was observed complete on October 15, 2026.
2. Configure a repository Actions secret named **WIKI_TOKEN** with a credential that can write to this repository's Wiki. For this private repository, a personal access token (classic) with the `repo` scope is a documented compatible option. Choose an expiry and rotate it before expiry. That classic scope is broader than this Wiki; keep the token in Actions secrets only. Do not place it in source files, commits, chat, or workflow logs.
3. Merge the documentation/Wiki workflow PR into `main` through the normal review process.
4. Open Actions → Publish GitHub Wiki. The merge triggers publishing; alternatively select Run workflow on `main`.
5. Check that both validation and publishing jobs succeed, then open the repository's Wiki.

Secret settings: https://github.com/judyzhou666/ibm-campus_compass/settings/secrets/actions

The default `GITHUB_TOKEN` is used only for reading the source checkout. The Wiki publisher uses `WIKI_TOKEN` for its separate Git repository. It never copies your local GitHub CLI or SSH credentials into Actions.

## Routine editing

Edit `wiki/*.md` on your team branch, then open a PR to `main`. Validation runs in the PR without secrets. Publishing runs only on `main`, after validation, for changes to Wiki sources or publishing code; manual dispatch is also restricted to `main`.

The script clones the Wiki's current default branch (currently `master`), updates matching files, and pushes a normal commit. It preserves unrelated Wiki pages and does not force-push. An unchanged source creates no commit. Removed/renamed source pages are not automatically deleted from the live Wiki: remove obsolete pages deliberately through GitHub after reviewing them.

## Troubleshooting

- **Missing WIKI_TOKEN:** add the repository Actions secret, then rerun the failed workflow.
- **Repository not found:** confirm Wiki availability for your GitHub plan, first-page initialization, and the token's access to the correct account/repository. Private Wikis require a supporting GitHub plan.
- **Authentication failure:** replace an expired/revoked token and rerun.
- **Push rejected:** a concurrent edit may have advanced the Wiki. Rerun to clone the latest version; review conflicting manual edits in source if needed.
- **No Run workflow button:** the workflow must first exist on the default branch.

## Local validation

```sh
bash -n scripts/publish-wiki.sh
python3 -m unittest discover -s tests -p 'test_publish_wiki.py' -v
```

The tests use temporary local Git repositories. They do not use a token, network access, or the real Wiki.

## References

- GitHub: [Adding or editing wiki pages](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages).
- GitHub: [Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).
- Wiki publisher maintainers: [Wiki repository and credential requirements](https://github.com/SwiftDocOrg/github-wiki-publish-action#setup). This project uses its own small publisher script, not that archived action.
