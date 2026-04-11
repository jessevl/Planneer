#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRAMEER_DIR="$ROOT_DIR/frameer"

frameer_message=""
parent_message=""
allow_parent_changes=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/publish-frameer.sh [options]

Publishes the nested frameer repo first, then updates and pushes the parent
planneer-frontend submodule reference so the two repos stay in sync.

Options:
  --frameer-message <msg>   Commit message for frameer if frameer has local changes
  --parent-message <msg>    Commit message for the parent submodule pointer update
  --allow-parent-changes    Allow unrelated parent repo changes to exist
  --help                    Show this help text

Examples:
  ./scripts/publish-frameer.sh \
    --frameer-message "fix: update nav item import" \
    --parent-message "chore: bump frameer"

  ./scripts/publish-frameer.sh

Behavior:
  1. Verifies both repos are on branches, not detached HEADs.
  2. Refuses to run if the parent repo has unrelated changes unless
     --allow-parent-changes is provided.
  3. Commits and pushes frameer first if it has uncommitted changes.
  4. Stages frameer in the parent repo, commits the submodule ref update,
     and pushes the parent repo.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frameer-message)
      frameer_message="${2:-}"
      shift 2
      ;;
    --parent-message)
      parent_message="${2:-}"
      shift 2
      ;;
    --allow-parent-changes)
      allow_parent_changes=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_repo() {
  local repo_dir="$1"
  git -C "$repo_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "Not a git repository: $repo_dir" >&2
    exit 1
  }
}

require_branch() {
  local repo_dir="$1"
  local repo_name="$2"
  local branch
  branch="$(git -C "$repo_dir" rev-parse --abbrev-ref HEAD)"

  if [[ "$branch" == "HEAD" ]]; then
    echo "$repo_name is in detached HEAD state. Check out a branch before publishing." >&2
    exit 1
  fi

  printf '%s' "$branch"
}

require_repo "$ROOT_DIR"
require_repo "$FRAMEER_DIR"

parent_branch="$(require_branch "$ROOT_DIR" "planneer-frontend")"
frameer_branch="$(require_branch "$FRAMEER_DIR" "frameer")"

parent_extra_changes="$({ git -C "$ROOT_DIR" status --porcelain=v1 || true; } | awk '$2 != "frameer" { print }')"
if [[ -n "$parent_extra_changes" && "$allow_parent_changes" -ne 1 ]]; then
  echo "Parent repo has changes unrelated to the frameer submodule. Commit or stash them first, or rerun with --allow-parent-changes." >&2
  echo "$parent_extra_changes" >&2
  exit 1
fi

frameer_status="$(git -C "$FRAMEER_DIR" status --porcelain=v1)"
if [[ -n "$frameer_status" ]]; then
  if [[ -z "$frameer_message" ]]; then
    echo "frameer has local changes. Provide --frameer-message to commit them before publishing." >&2
    echo "$frameer_status" >&2
    exit 1
  fi

  echo "Committing frameer changes on branch $frameer_branch"
  git -C "$FRAMEER_DIR" add -A
  git -C "$FRAMEER_DIR" commit -m "$frameer_message"
fi

frameer_sha="$(git -C "$FRAMEER_DIR" rev-parse HEAD)"

echo "Pushing frameer ($frameer_branch @ ${frameer_sha:0:7})"
git -C "$FRAMEER_DIR" push origin "$frameer_branch"

echo "Updating planneer-frontend submodule pointer"
git -C "$ROOT_DIR" add frameer

if git -C "$ROOT_DIR" diff --cached --quiet -- frameer; then
  echo "Parent repo already points at frameer ${frameer_sha:0:7}. Nothing to commit in planneer-frontend."
  exit 0
fi

if [[ -z "$parent_message" ]]; then
  parent_message="chore: bump frameer to ${frameer_sha:0:7}"
fi

git -C "$ROOT_DIR" commit -m "$parent_message"

echo "Pushing planneer-frontend ($parent_branch)"
git -C "$ROOT_DIR" push origin "$parent_branch"

echo "Published frameer and updated the parent submodule reference successfully."