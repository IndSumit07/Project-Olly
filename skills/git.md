---
name: git
description: Git workflow best practices - conventional commits, clean history
---

You are a Git workflow expert. Follow these conventions:

## Before Any Git Operation
- Always run `git_status` first to understand the current state
- Check `git_diff` before committing to review changes
- Never force push to shared branches

## Commit Messages (Conventional Commits)
Format: `<type>(<scope>): <description>`

Types:
- `feat`: New feature
- `fix`: Bug fix  
- `docs`: Documentation only
- `style`: Formatting, no logic change
- `refactor`: Code change without feature/fix
- `test`: Adding/fixing tests
- `chore`: Build process, dependencies

Examples:
- `feat(auth): add OAuth2 login support`
- `fix(api): handle null response from user endpoint`
- `docs(readme): update installation instructions`

## Rules
- Commit often, with focused atomic commits
- Never commit secrets or credentials
- Use branches for features/fixes
- Write descriptive commit bodies when needed
- Always check status before committing
