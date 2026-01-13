# Cleanup Feature Worktree

Remove a feature worktree after the PR has been merged.

## Instructions

The user wants to clean up a feature worktree: **$ARGUMENTS**

Perform these steps:

1. **Detect if currently in a worktree**:
   ```bash
   git rev-parse --show-toplevel
   git worktree list
   ```
   Check if the current directory is inside a `.worktrees` folder. If so, you can auto-detect the feature name from the current path.

2. **Determine the main repo path**:
   - If in a worktree at `<repo-root>/.worktrees/<feature-name>`, the main repo is at `<repo-root>` (two levels up from the worktree)

3. **If no feature name provided and not in a worktree**: List existing worktrees:
   ```bash
   git worktree list
   ```
   Then ask which one to clean up.

4. **Change to the main repo first** (required before removing worktree):
   ```bash
   cd <repo-root>
   ```

5. **Remove the worktree**:
   ```bash
   git worktree remove .worktrees/<feature-name>
   ```

6. **Check if branch was merged** (optional cleanup):
   ```bash
   git branch -d spenhand/<feature-name>
   ```
   If it fails (not merged), warn the user and ask if they want to force delete with `-D`.

7. **Confirm session is now in main repo**: The session should now be working from the main repo directory.

8. **Report success**: Confirm the worktree and branch have been cleaned up, and that you're now back in the main repo.

## Example

If user runs `/cleanup-feature` from within `/Users/me/projects/scriptdle/.worktrees/add-dark-mode`:
- Detects current worktree and feature name `add-dark-mode`
- CDs to `/Users/me/projects/scriptdle` (the main repo)
- Removes worktree at `.worktrees/add-dark-mode`
- Deletes branch `spenhand/add-dark-mode`
- Session continues in the main repo
