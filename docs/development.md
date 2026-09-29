# Development

## Architecture

The app uses a Vite SPA, Svelte 5 runes, and strict TypeScript. `src/app/` composes the workspace, `src/lib/components/` contains the UI, and `src/lib/styles/tokens.css` is the single source of design tokens.

The frontend calls typed IPC through [client.ts](../src/lib/ipc/client.ts), selecting the [real adapter](../src/lib/ipc/real.ts) inside Tauri or the [mock adapter](../src/lib/ipc/mock.ts) for the browser demo. Data contracts live in [types.ts](../src/lib/ipc/types.ts) and the Rust DTOs under [domain](../src-tauri/src/domain/) and [commands](../src-tauri/src/commands/). When changing a payload, update both sides and verify JSON serialization.

The backend is divided into `commands/` for IPC handlers, `git/` for system Git, `services/` for the session/job registry, `domain/` for DTOs and errors, and `persistence/` for settings. The [lib.rs](../src-tauri/src/lib.rs) entry point registers commands. Do not expose a shell or an API that accepts arbitrary argv to the frontend.

## Git and data

- Treat repository contents, filenames, configuration, commit messages, and remote output as untrusted data. Rust validates payloads and path tokens; the UI renders plain text. Never treat frontend cache as Git truth.
- Use system Git through [runner.rs](../src-tauri/src/git/runner.rs), with a fixed executable and argv list and no shell. Preserve the trust gate, environment sanitization, timeout and output bounds, and redaction. Do not modify global `safe.directory`, delete locks, or replay a mutation when its result is unknown.
- Mutations must use repository/version/action/path identities validated by the backend, queue against the common directory, revalidate before writing, and refresh after completion. Confirmations must bind to a specific target; discard and hunk actions must verify their fingerprint or token.
- Settings and workspaces are stored locally through [store.rs](../src-tauri/src/persistence/store.rs), preserving schema migrations and atomic writes. Do not change the identifier or storage namespace solely for branding; linked worktrees must retain distinct workspace identities.
- Do not log or save credentials or tokens in app settings. Git credential helpers and SSH agents manage credentials; a token entered in the UI may only pass through a controlled typed-command flow. Test Git mutations in temporary repositories, never in a user's repository.

## Verification

Build and check commands are listed in the [README](../README.md#build-and-test). Vitest uses `tests/unit/`; Rust tests live beside their implementations; `tests/ui/` contains browser fixtures. [Release tests](../tests/release/check-release.py) use a temporary filesystem and a fake `gh`, and never publish a real release.

For UI changes, inspect the running screen, loading/empty/error states, and keyboard behavior; do not rely only on demo data or screenshots. For Git and IPC changes, verify behavior in a temporary repository, including stale-state and error cases. Report exactly which checks ran and any blockers. A browser demo does not prove a native Git workflow.

## Verification status

Priority Git and draft fixes on 2026-09-29: normal Push now binds the selected remote and one full destination ref, supports differently named upstream branches, validates the effective push URL, rejects multiple destinations, and neutralizes mirror/follow-tag/default-refspec settings. Reword and Edit author preserve the original commit tree and staged/unstaged changes. Draft persistence retains the amend target and both messages; a fresh snapshot must verify HEAD after reopening, with Refresh available after read failures. Reword loads the full message before enabling submission and preserves edits after write failures.

This isolated PR checkout is based on upstream `main` at `fee8625`. Verification passes 141 frontend tests, 165 Rust tests (including the loopback HTTP test), 15 release-tooling checks, ESLint, Svelte/TypeScript (0 errors, 19 existing warnings), frontend production build, Rust fmt, and clippy. Six new Rust tests exercise the actual command code in temporary repositories, including push target/configuration boundaries and metadata-only edits; five new frontend tests cover draft persistence and validation. Browser QA on the working checkout covered restored drafts, changed/unreadable HEAD and retry, Reword loading/read/write failures and unchanged body preservation, normal Ctrl+Enter commit, and message-only amend after remount. The Debian build was verified in that working checkout before integration onto this newer upstream tree; it is not a package of this PR checkout. Native UI E2E remains **blocked** because native app control is unavailable. Existing unrelated workspace changes are excluded from this PR.

PR integration verification on 2026-09-29: applied the amend change to upstream `main` at `33e7f8c`, preserving the newer partial-staging, tab-order, and Git-test identity changes. This isolated PR checkout passes 136 frontend tests, 159 Rust tests (including the loopback HTTP test), ESLint, Svelte/TypeScript (0 errors, 19 existing warnings), frontend production build, Rust fmt, and clippy. The Debian build recorded below predates this upstream integration; native UI E2E remains unverified. The PR excludes the separate local launcher/build-setup changes.

Commit amend added on 2026-09-29. The working-changes composer now offers **Amend last commit**, loads the current HEAD subject/body, identifies the commit being replaced, and supports staged-file or message-only amendments. Turning the option off or completing the amend restores the previous new-commit draft; failures keep the amend draft. Loading disables submission, and unborn HEAD or an observed HEAD change blocks amendment. The typed `commit_create` request carries a nullable `amendOid`; Rust validates trust/version/target, queues on the common directory, checks live HEAD and operation markers before writing, and runs `git commit --amend -F -` through the existing Git runner. Git retains the original author/parents and includes only the index.

Amend verification: 134 frontend unit tests pass, including adapter behavior and the real IPC payload; Svelte/TypeScript reports 0 errors and 17 existing warnings; ESLint and the production frontend build pass. Rust fmt and clippy pass. All 155 Rust tests pass across two runs: 154 in the sandbox and the HTTP-stub test rerun with loopback permission. The commit tests use temporary repositories and cover staged versus unstaged content, author/parent preservation, root and detached HEAD, message-only amendments, stale HEAD/version, untrusted/unborn repositories, operation markers, invalid requests, signing failure, and JSON compatibility. Git mutation tests used temporary repositories.

Browser QA passed for prefill, draft restoration, Ctrl+Enter, no-staged-file amendment, loading, read failure, commit failure, and unborn HEAD. The reusable [amend fixture](../tests/ui/commit-amend.html) exposes loading/failure switches through the real workspace component with mock IPC. Read failure originally left the checkbox checked despite remaining in create mode; the checkbox now reflects only successfully loaded amend state. Native Tauri UI E2E is **blocked** in this session because native app control is unavailable; Rust command tests and browser QA do not count as native UI acceptance.

Desktop rebuild on 2026-09-29 after the amend change passed: frontend production build, optimized Rust release (3m 04s), and Debian packaging. The build used the pinned Rust toolchain and a CLI-only override to run the existing Vite installation directly, without changing the tracked build configuration or lockfiles. Outputs are `src-tauri/target/release/octopus` and `src-tauri/target/release/bundle/deb/Octopus_0.1.0_amd64.deb` (5,516,988 bytes). `dpkg-deb --info` and `--contents` verified package version 0.1.0, amd64 architecture, executable, desktop entry, and icons. Existing frontend warnings remain; no build errors or packaging blockers occurred. Installation and native UI E2E were not performed.

Updated 2026-09-25. The results below were run during development sessions and do not replace a GitHub CI run:

- Frontend: 129 unit tests pass in the current workspace; ESLint passes; Svelte/TypeScript reports no errors and 19 existing CSS/accessibility warnings. The production frontend build passes.
- Rust: 145 tests passed (144 inside the sandbox and one HTTP-stub test rerun with loopback permission); fmt and clippy pass.
- Native packaging: the browser Welcome/workspace and a native launch from the `.deb` were checked for the Octopus name and icon. `.deb` and `.rpm` builds pass. An AppImage was created and its contents were inspected, but the last bundle command exited during post-processing because the executable was running (`Text file busy`).
- Release tooling: actionlint, Bash/YAML syntax, and 15 offline release tests pass. The GitHub-hosted end-to-end build and publication have **not run yet** and require a real GitHub trigger.
- Native acceptance is still missing for reading a repository; stage/commit; sync/merge/conflict; multiple repositories and restart in the native UI; real Bitbucket/remote authentication; frame/memory profiling; and Windows/macOS. Native milestones M1–M4 remain unaccepted. Automated release publication does not change that status.

Project cleanup on 2026-09-25 replaced 112 historical documentation files with the current compact documentation set, removed an unimplemented test script, and repaired related references and configuration. Verification reran 128 unit tests, 15 release tests, Svelte/TypeScript (0 errors, 19 warnings), lint, production frontend build, Rust fmt, Bash syntax, and actionlint; all passed. Thirty local Markdown links/anchors and all native icon paths were checked, with no remaining references to removed documents. The Rust changes in that cleanup affected comments only, so Rust tests and native bundles were not rerun. A backup of the pre-cleanup content was stored outside the repository; the Git index and other user changes were preserved.

When handing off work, update this section with the current changes, checks, and blockers. Do not create a separate evidence or handoff directory for each task. Add documentation only when it provides durable maintenance guidance.

The GitHub Actions error `Cannot find name 'node:process'` at `vite.config.ts:3` was reproduced in a fresh copy installed with `pnpm install --frozen-lockfile --offline`, where it produced 1 error and 19 warnings. The fix adds the directly pinned `@types/node` dev dependency at version `24.13.6`, updates the lockfile, and includes `node` in `tsconfig`. After a frozen-lockfile reinstall, the fresh copy passes type checking (0 errors, 19 warnings), lint, 128 unit tests, and the production build. This fix must be pushed before it can be verified on a GitHub-hosted runner; rerunning an older commit still uses its old dependency set.

The README was converted to English and its legacy branding/data section was removed at the user's request. Five images in `docs/images/` were captured from the current interface with browser demo data: history/multiple repositories, working diff/staging, branch actions, stash, and pull-request creation. These are README illustrations, not proof of native Git E2E behavior. Playwright captured the full-interface images at a 1440×800 viewport and the dialogs by element for legible text. No real Git repository or runtime UI behavior was changed to produce them. Each image was inspected and the README was rendered: all five images loaded, there was no horizontal overflow at 1100px, 35 local links/anchors were valid, and the image set totals about 372 KiB. Final workspace checks, lint, and 129 unit tests passed; concurrent branch-checkout changes were preserved.

Documentation language cleanup on 2026-09-25 converted `AGENTS.md`, `docs/development.md`, `docs/release.md`, and `docs/progress.md` to English and updated the README verification anchor. Commands, paths, safety requirements, release behavior, and recorded verification results were preserved.

## Icon

Master asset: [public/brand/octopus.png](../public/brand/octopus.png). It is a mint octopus on a charcoal background, with tentacles suggesting Git nodes and branches and no text. The icon was created with image generation and is used for the launcher, Welcome screen, repository tabs, and favicon.

Regenerate desktop icons into a temporary directory for review before copying them:

```sh
pnpm tauri icon public/brand/octopus.png --output /tmp/octopus-generated-icons
```

Copy the desktop PNG/ICO/ICNS files from the output root into `src-tauri/icons/`, copy `128x128.png` to `public/brand/octopus-128.png`, and copy `32x32.png` to `public/favicon.png`. Bundle paths are declared in [tauri.conf.json](../src-tauri/tauri.conf.json).
