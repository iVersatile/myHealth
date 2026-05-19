#!/usr/bin/env bash
# myHealth agent team — tmux multi-pane launcher
#
# Layout:
#   ┌─────────────────────┬────────────────────┐
#   │  [0] Orchestrator   │  [1] Backend       │
#   │  (project root)     │  (src-tauri / Rust)│
#   ├─────────────────────┼────────────────────┤
#   │  [2] Frontend       │  [3] Review / logs │
#   │  (src / Next.js)    │  (project root)    │
#   └─────────────────────┴────────────────────┘
#
# Usage:
#   ./scripts/team.sh          — start session (attaches automatically)
#   ./scripts/team.sh stop     — kill session

set -euo pipefail

SESSION="myhealth"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/src-tauri"
FRONTEND="$ROOT/src"

if [[ "${1:-}" == "stop" ]]; then
  tmux kill-session -t "$SESSION" 2>/dev/null \
    && echo "Session '$SESSION' stopped." \
    || echo "No session '$SESSION' running."
  exit 0
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already running — attaching."
  exec tmux attach-session -t "$SESSION"
fi

# ── Create session with pane 0 (Orchestrator) ─────────────────────────────────
tmux new-session -d -s "$SESSION" -n "team" -x 220 -y 50 -c "$ROOT"

# Split right → pane 1 (Backend)
tmux split-window -h -t "$SESSION:0.0" -c "$BACKEND"

# Split pane 0 down → pane 2 (Frontend)
tmux split-window -v -t "$SESSION:0.0" -c "$FRONTEND"

# Split pane 1 down → pane 3 (Review / logs)
tmux split-window -v -t "$SESSION:0.1" -c "$ROOT"

# Even out the layout
tmux select-layout -t "$SESSION:0" tiled

# ── Start claude in each pane ─────────────────────────────────────────────────

# Pane 0 — Orchestrator: plain claude (you drive this one)
tmux send-keys -t "$SESSION:0.0" "claude" Enter

# Pane 1 — Backend: Rust/Tauri context
tmux send-keys -t "$SESSION:0.1" "claude --system-prompt 'You are the Backend agent for the myHealth project. Work exclusively in src-tauri (Rust/Tauri). Focus: Rust commands, DB migrations, parsing, crypto. Follow CLAUDE.md and PLAN-v2.md.'" Enter

# Pane 2 — Frontend: Next.js context
tmux send-keys -t "$SESSION:0.2" "claude --system-prompt 'You are the Frontend agent for the myHealth project. Work exclusively in src/ (Next.js 14, TypeScript, Tailwind, Zustand). Follow CLAUDE.md and PLAN-v2.md.'" Enter

# Pane 3 — Review: code review and test runner
tmux send-keys -t "$SESSION:0.3" "claude --system-prompt 'You are the Review agent for the myHealth project. Run cargo test, pnpm test, review code changes for quality, security, and coverage. Follow CLAUDE.md.'" Enter

# Focus orchestrator pane
tmux select-pane -t "$SESSION:0.0"

echo ""
echo "✓ myHealth team session started (4 panes)"
echo "  [0] Orchestrator  — $ROOT"
echo "  [1] Backend       — $BACKEND"
echo "  [2] Frontend      — $FRONTEND"
echo "  [3] Review/Logs   — $ROOT"
echo ""
echo "  Stop: ./scripts/team.sh stop"
echo ""
exec tmux attach-session -t "$SESSION"
