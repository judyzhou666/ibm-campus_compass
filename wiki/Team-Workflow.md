# Team workflow

`main` is the shared, reviewed version of the project. Each of us works on our **own branch** and asks the team to review it with a **pull request** before it joins `main`.

| Teammate | Branch |
| --- | --- |
| Judy | `Judy` |
| Doris | `Doris` |
| Bella | `Bella` |
| Tingting | `Tingting` |

Branch names are case-sensitive: `Judy`, not `judy`.

## Daily routine (copy and paste)

Replace `Judy` with **your** branch name in every command.

**1. Start from the latest team version.** Run these in Terminal:

```sh
cd ~/ibm-campus_compass
git switch Judy
git pull
git merge origin/main
```

If `git merge` prints "CONFLICT", stop and ask in the team chat before going further.

**2. Make your changes** (in Bob IDE or any editor), then run the website and tests to check nothing broke:

```sh
npm test
npm run build
cargo test --locked
```

**3. Save your work to GitHub:**

```sh
git add -A
git status
```

Read the list `git status` prints. **If you see `.env` in it, stop**: that file holds your secret key and must never be uploaded. (It is normally hidden by `.gitignore`.)

```sh
git commit -m "Describe what you changed in one sentence"
git push origin Judy
```

**4. Ask for review:** open https://github.com/judyzhou666/ibm-campus_compass, click **Compare & pull request** for your branch, set the base to `main`, describe your change, and click **Create pull request**. After a teammate approves, click **Merge**.

## Where things go

- `README.md`: what changed, how to run it, test results and limits. Update it with every pull request.
- `docs/`: longer project notes and setup instructions.
- `wiki/`: the pages of this Wiki.
- `bob_sessions/<your name>/`: your exported IBM Bob sessions (see [IBM Bob](IBM-Bob)).

## Editing this Wiki

The Wiki is published automatically from the `wiki/` folder:

1. Edit or add a Markdown page in `wiki/` on your branch (for example `wiki/Getting-Started.md`). Add new pages to `wiki/_Sidebar.md`.
2. Open a pull request into `main`. GitHub checks the publisher.
3. After the pull request is merged, the **Publish GitHub Wiki** action updates the Wiki within a few minutes.

Do not edit pages directly on the Wiki website: the next publish will overwrite your change. Removing or renaming a file in `wiki/` does not delete the old Wiki page; delete it on GitHub by hand. Setup details: [docs/github-wiki.md](https://github.com/judyzhou666/ibm-campus_compass/blob/main/docs/github-wiki.md).
