#!/bin/zsh
# Open Claude Code in this folder, whatever it is called
source "$HOME/.zshrc" >/dev/null 2>&1
export PATH="$HOME/.claude/local:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1
clear
echo "Starting Claude Code in: $(pwd)"
echo
exec claude
