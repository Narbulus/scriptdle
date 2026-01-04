# Cleanup Feature Worktree

Remove a feature worktree after the PR has been merged.

## Instructions

The user wants to clean up a feature worktree: **$ARGUMENTS**

Perform these steps:

1. **Validate input**: If no feature name was provided, list existing worktrees:
   ```bash
   git worktree list
   ```
   Then ask which one to clean up.

2. **Determine paths**:
   - Branch: `spenhand/<feature-name>`
   - Worktree: `/Users/spencer.anderson/projects/scriptdle-<feature-name>`

3. **Check if worktree exists**:
   ```bash
   git worktree list | grep <feature-name>
   ```

4. **Remove the worktree**:
   ```bash
   git worktree remove /Users/spencer.anderson/projects/scriptdle-<feature-name>
   ```

5. **Check if branch was merged** (optional cleanup):
   ```bash
   git branch -d spenhand/<feature-name>
   ```
   If it fails (not merged), warn the user and ask if they want to force delete with `-D`.

6. **Report success**: Confirm the worktree and branch have been cleaned up.

## Example

`/cleanup-feature add-dark-mode` removes:
- Worktree at `/Users/spencer.anderson/projects/scriptdle-add-dark-mode`
- Branch `spenhand/add-dark-mode`
