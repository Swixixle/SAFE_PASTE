# SafePaste — optional zsh helpers for Claude Code / terminal workflows.
# Add to ~/.zshrc:
#   source /absolute/path/to/SAFE_PASTE/terminal/safe-paste.zsh

if [[ -n "$ZSH_VERSION" ]]; then
  _SP_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
  SAFE_PASTE_ROOT="$(cd "${_SP_DIR}/.." && pwd)"
  export SAFE_PASTE_ROOT
  unset _SP_DIR
fi

sp-sanitize-clipboard() {
  node "${SAFE_PASTE_ROOT}/terminal/sanitize-clipboard.mjs" "$@"
}

# Sanitize system clipboard in place (run before pasting into Claude Code / terminal).
alias sp-c='sp-sanitize-clipboard'
