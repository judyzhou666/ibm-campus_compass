# Team workflow

`main` is the shared project branch. Work in your own branch and use a pull request for team review:

| Team branch |
| --- |
| `Judy` |
| `Doris` |
| `Bella` |
| `Tingting` |

For example:

```sh
git fetch origin
git switch Judy
git merge origin/main
```

Replace `Judy` with your own branch name. Resolve any conflicts before pushing your work.

## Documentation locations

- `docs/`: new project documentation, implementation notes, and setup instructions.
- `wiki/`: source pages intended for the GitHub Wiki.
- Existing root documents remain in place unless the team chooses to reorganize them.

Only changes merged into `main` publish automatically. Pull requests validate the publisher without using the publishing secret or modifying the Wiki. The workflow can also be run manually from `main`.

## Updating pages

Edit pages in `wiki/`, including `Home.md` and `_Sidebar.md`. Matching Wiki pages are updated automatically; pages that exist only on the Wiki are preserved. Removing or renaming a source file does not delete its old Wiki page. Review and remove obsolete pages explicitly on GitHub when needed.

Setup instructions are in [docs/github-wiki.md](https://github.com/judyzhou666/ibm-campus_compass/blob/main/docs/github-wiki.md).
