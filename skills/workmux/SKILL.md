---
name: workmux
description: >-
  Use when managing worktrees and tmux windows with workmux, or dispatching and monitoring agents
  through workmux. Covers target placement, task handoffs, status, and cleanup.
---

# workmux

workmux pairs a Git worktree with a managed terminal target. Use its CLI to create, monitor, and
remove these environments. For flags beyond the recipes below, use `workmux <command> --help`.

## Dispatch

1. Establish the target repository, base branch, task scope, and intended tmux session. Inspect only
   what is needed for a useful handoff; let the worker investigate its implementation.
2. Check project `.workmux.yaml` and relevant global configuration before provisioning. Creation can
   copy or link files, run hooks, and start configured pane commands. Use `workmux config reference`
   for configuration details; do not assume creation is only a Git operation.
3. Write a prompt file with the outcome, context, allowed changes, verification, and stopping
   conditions. Preserve the user's limits on commits, pushes, and external changes.
4. Run from the target repository, using an absolute prompt path:

   ```bash
   workmux add <branch> --base <base> -b -P <prompt-file> --mode window --parent-session <session>
   ```

The working directory selects the repository; `--parent-session` selects the tmux session for
window-mode targets. They are independent. Pass the session explicitly when placement matters:
background tools can lack `$TMUX_PANE`. Workmux creates a missing parent session; do not create a
separate tmux window or session first. Use `--mode window` to override a configured session mode.

Use `--target-name` only to override the terminal target name. Use `--name` to override the worktree
handle. Do not move existing edits with `--with-changes` unless requested.

### Worktree without an agent

```bash
workmux add <local-branch> --headless --json
```

Headless creation still applies file operations and hooks, but starts no terminal or agent.
Use the returned handle, worktree path, and working directory. Do not combine this mode with prompts
or multiplexer options. The worktree persists until removed; `workmux open <handle>` can attach a
managed terminal later.

## Monitor and follow up

Use handles returned by workmux. Agent commands can resolve outside the current repository;
use `project:handle` when names are ambiguous.

```bash
workmux list
workmux status <handle>
workmux capture <handle> -n 100
workmux send <handle> -f <followup-file>
workmux wait <handle> --timeout 300
```

Check output when an agent is waiting or appears stuck. Send corrections or missing context.
Use a bounded wait rather than repeated status polling. `wait` defaults to agent status `done`;
`add --wait` instead waits for the terminal window to close. Neither proves task correctness.
Inspect the worker's changes and verification evidence before reporting completion.

## Finish and clean up

Follow the project's integration workflow and the user's authorization. Do not infer permission to
commit, merge, or discard changes from permission to create a worktree. Check the target and its Git
state before cleanup; retain evidence outside any directory being removed.

| Intent | Command | Effect |
| --- | --- | --- |
| Close terminal only | `workmux close <handle>` | Keeps worktree and branch |
| Reopen terminal | `workmux open <handle>` | Opens the managed terminal target |
| Merge and retain environment | `workmux merge <handle> --into <base> --keep` | Skips cleanup |
| Merge and clean up | `workmux merge <handle> --into <base> --cleanup` | Removes worktree, terminal, branch |
| Remove without merging | `workmux remove <handle>` | Removes worktree, terminal, branch |
| Remove but retain branch | `workmux remove <handle> --keep-branch` | Removes worktree and terminal |

Use explicit targets. Confirm the configured merge strategy and hooks before merging. Force removal
can discard uncommitted work; use it only with explicit authorization. After cleanup, check
`workmux list` and report what remains. Do not assume companion slash-command skills are installed.
