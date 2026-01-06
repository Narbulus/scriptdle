# Scriptdle Project

## Git Worktrees

This project uses git worktrees for isolated feature development.

**Worktrees location**: `<repo-root>/.worktrees/<feature-name>`

### Workflow Commands

- `/feature <name>` - Create a new worktree for feature development
- `/cleanup-feature` - Remove a worktree after the PR has been merged

### How It Works

1. Worktrees are created in the `.worktrees/` directory at the repo root
2. Each worktree gets its own branch: `spenhand/<feature-name>`
3. The session CDs into the worktree for development
4. When done, use `/cleanup-feature` to remove the worktree and return to main repo
