#!/usr/bin/env bash
# Updates matching pages and preserves pages managed directly in the Wiki.
set -euo pipefail

source_dir="${1:-wiki}"
: "${WIKI_REMOTE_URL:?Set WIKI_REMOTE_URL to the initialized Wiki Git repository.}"

if [[ ! -s "$source_dir/Home.md" ]]; then
  echo 'The source directory must contain a non-empty Home.md.' >&2
  exit 1
fi
if [[ -n "$(find "$source_dir" \( -name .git -o -type l \) -print -quit)" ]]; then
  echo 'Wiki source must not contain Git metadata or symbolic links.' >&2
  exit 1
fi

# The temporary clone is outside the source checkout. Credentials stay in the
# environment; neither the remote URL nor Git config contains the token.
tmp_dir="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/campus-wiki.XXXXXX")"
trap 'rm -rf -- "$tmp_dir"' EXIT
if [[ -n "${WIKI_TOKEN:-}" ]]; then
  cat > "$tmp_dir/askpass" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *Password*) printf '%s\n' "$WIKI_TOKEN" ;;
  *) exit 1 ;;
esac
ASKPASS
  chmod 700 "$tmp_dir/askpass"
  export GIT_ASKPASS="$tmp_dir/askpass"
fi
export GIT_TERMINAL_PROMPT=0

if ! git clone --quiet --depth 1 "$WIKI_REMOTE_URL" "$tmp_dir/wiki"; then
  echo 'Could not clone the Wiki. Create its first page in GitHub and check Wiki write access; see docs/github-wiki.md.' >&2
  exit 1
fi
wiki_branch="$(git -C "$tmp_dir/wiki" symbolic-ref --short HEAD)"

# Deliberately omit --delete: unrelated or previously published pages survive.
rsync -a --exclude='.git/' "$source_dir/" "$tmp_dir/wiki/"
git -C "$tmp_dir/wiki" add --all
if git -C "$tmp_dir/wiki" diff --cached --quiet; then
  echo 'Wiki already matches these source pages; no commit needed.'
  exit 0
fi

git -C "$tmp_dir/wiki" \
  -c user.name='github-actions[bot]' \
  -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
  commit --quiet -m "Publish Campus Compass Wiki from ${SOURCE_SHA:-local}"
# A concurrent human edit causes a normal non-fast-forward rejection. Nothing
# is force-pushed; rerun to clone the latest Wiki and reapply the source pages.
git -C "$tmp_dir/wiki" push origin "HEAD:refs/heads/$wiki_branch"
echo "Published Wiki pages to $wiki_branch."
