#!/bin/zsh
# Open Claude Code in the jev-test folder
source "$HOME/.zshrc" >/dev/null 2>&1
export PATH="$HOME/.claude/local:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$HOME/Desktop/jev-test" || exit 1
clear
echo "Starting Claude Code in: $(pwd)"
echo
exec claude
