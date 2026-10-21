#!/usr/bin/env bash
# Hook PreToolUse (Read): impide leer src/CONSTANTS.js.
# Recibe el JSON de la herramienta por stdin; sale con código 2 para bloquear.

archivo=$(jq -r '.tool_input.file_path // empty')

case "$archivo" in
  */src/CONSTANTS.js | src/CONSTANTS.js)
    echo "Bloqueado: no se permite leer src/CONSTANTS.js" >&2
    exit 2
    ;;
esac

exit 0
