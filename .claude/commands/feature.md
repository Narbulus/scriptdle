# Create Feature Worktree

Create a new git worktree for isolated feature development.

## Instructions

The user wants to start working on a new feature: **$ARGUMENTS**

Perform these steps:

1. **Validate input**: If no feature name was provided, ask the user what they want to call the feature.

2. **Create the branch name**: Use the format `spenhand/<feature-name>` (convert spaces to hyphens, lowercase).

3. **Determine worktree path**: Create the worktree as a sibling directory:
   - Current repo: `/Users/spencer.anderson/projects/scriptdle`
   - Worktree: `/Users/spencer.anderson/projects/scriptdle-<feature-name>`

4. **Fetch latest main**:
   ```bash
   git fetch origin main
   ```

5. **Create the worktree with new branch**:
   ```bash
   git worktree add -b spenhand/<feature-name> <worktree-path> origin/main
   ```

6. **Install dependencies in the new worktree**:
   ```bash
   cd <worktree-path> && npm install
   ```

7. **Report success**: Tell the user:
   - The worktree path they should open in a new Claude Code session
   - The branch name created
   - Remind them to run `npm run dev` to start developing
   - When done, they can push and create a PR, then clean up with:
     ```bash
     git worktree remove <worktree-path>
     git branch -d spenhand/<feature-name>  # after PR is merged
     ```

## Example

If the user runs `/feature add dark mode`, create:
- Branch: `spenhand/add-dark-mode`
- Worktree: `/Users/spencer.anderson/projects/scriptdle-add-dark-mode`
