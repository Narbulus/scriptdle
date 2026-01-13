# Create Feature Worktree

Create a new git worktree for isolated feature development.

## Instructions

The user wants to start working on a new feature: **$ARGUMENTS**

Perform these steps:

1. **Validate input**: If no feature name was provided, ask the user what they want to call the feature.

2. **Create the branch name**: Use the format `spenhand/<feature-name>` (convert spaces to hyphens, lowercase).

3. **Determine paths**:
   - Get the repo root: `git rev-parse --show-toplevel`
   - Worktrees folder: `<repo-root>/.worktrees`
   - Worktree path: `<repo-root>/.worktrees/<feature-name>`

4. **Create worktrees folder if needed**:
   ```bash
   mkdir -p .worktrees
   ```

5. **Fetch latest main**:
   ```bash
   git fetch origin main
   ```

6. **Create the worktree with new branch**:
   ```bash
   git worktree add -b spenhand/<feature-name> .worktrees/<feature-name> origin/main
   ```

7. **Install dependencies in the new worktree**:
   ```bash
   cd .worktrees/<feature-name> && npm install
   ```

8. **Change to the worktree directory**: Use `cd` to switch the current session to the new worktree. This is critical - the session should now be working from within the worktree.

9. **Report success**: Tell the user:
   - You are now working in the worktree
   - The branch name created: `spenhand/<feature-name>`
   - Remind them to run `npm run dev` to start developing
   - When done, they can use `/cleanup-feature` from within the worktree to clean up and return to the main repo

## Example

If the user runs `/feature add-dark-mode` from a repo at `/Users/me/projects/scriptdle`:
- Branch: `spenhand/add-dark-mode`
- Worktrees folder: `/Users/me/projects/scriptdle/.worktrees`
- Worktree: `/Users/me/projects/scriptdle/.worktrees/add-dark-mode`
- Session CDs into the worktree and continues working from there
