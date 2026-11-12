#!/bin/bash
# Interactive installer. Uses only macOS built-ins; no Homebrew/npm/downloads.
set -u
PANEL='Atalhos AE.jsx'
WRAPPER='zz Atalhos AE - NULL.jsx'
ASSETS='Atalhos AE-assets'
ICONS=(adjustment.png airrack-text.png camera.png copy-ease.png experimental-3d-text.png flicker-text.png hologram-text.png null.png paste-ease.png null-action.jsxinc)

fail() { printf '\nAtalhos AE: %s\n' "$1" >&2; return 1; }
pause_if_interactive() { if [ -t 0 ]; then printf '\nPressione Enter para fechar / Press Enter to close... '; IFS= read -r answer || true; fi; }
file_hash() { /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{print $1}'; }

copy_owned_files() {
  local source="$1" app="$2" original_home="$3" scripts panel_root version target_directory source_file target_file temporary hash index i existing
  local targets=() sources=() backups=() hashes=() written=()
  case "$app" in *.app) ;; *) fail 'Selecione o aplicativo Adobe After Effects (.app).'; return 1;; esac
  [ -d "$app/Contents" ] || { fail 'O aplicativo selecionado esta incompleto.'; return 1; }
  local parent; parent="$(cd -P "$(dirname "$app")" && pwd)" || return 1
  case "$(basename "$parent")" in 'Adobe After Effects '*) ;; *) fail 'A pasta Adobe After Effects precisa conter o aplicativo e a pasta Scripts. Use a instalacao padrao da Adobe.'; return 1;; esac
  scripts="$parent/Scripts"
  [ ! -L "$scripts" ] || { fail 'Scripts e um link simbolico. Confira a instalacao manualmente para nao modificar o bundle assinado.'; return 1; }
  version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist" 2>/dev/null | /usr/bin/awk -F. '{print $1"."$2}')"
  panel_root="$scripts/ScriptUI Panels"
  if [ -n "$version" ] && [ -f "$original_home/Library/Preferences/Adobe/After Effects/$version/Scripts/ScriptUI Panels/$PANEL" ]; then
    panel_root="$original_home/Library/Preferences/Adobe/After Effects/$version/Scripts/ScriptUI Panels"
  fi
  sources+=("$source/$PANEL" "$source/$WRAPPER")
  targets+=("$panel_root/$PANEL" "$scripts/$WRAPPER")
  for name in "${ICONS[@]}"; do sources+=("$source/$ASSETS/$name"); targets+=("$panel_root/$ASSETS/$name"); done
  sources+=("$source/$ASSETS/null-action.jsxinc"); targets+=("$scripts/$ASSETS/null-action.jsxinc")
  for source_file in "${sources[@]}"; do [ -f "$source_file" ] && [ ! -L "$source_file" ] || { fail 'Pacote incompleto. Extraia o ZIP inteiro antes de instalar.'; return 1; }; done
  local backup="$original_home/Library/Application Support/Yleo Tools/Atalhos AE/backups/$(date +%Y%m%d-%H%M%S)-$$"
  /bin/mkdir -p "$backup" || return 1
  for ((i=0;i<${#targets[@]};i++)); do
    target_file="${targets[$i]}"
    if [ -L "$target_file" ] || [ -d "$target_file" ]; then fail "Destino inesperado: $target_file"; return 1; fi
    hashes[$i]="$(file_hash "${sources[$i]}")" || return 1
    backups[$i]=''
    if [ -f "$target_file" ]; then
      backups[$i]="$backup/$i-$(basename "$target_file")"
      /bin/cp -p "$target_file" "${backups[$i]}" || return 1
      [ "$(file_hash "$target_file")" = "$(file_hash "${backups[$i]}")" ] || return 1
    fi
  done
  local failed=0
  for ((i=0;i<${#targets[@]};i++)); do
    target_file="${targets[$i]}"; target_directory="$(dirname "$target_file")"
    /bin/mkdir -p "$target_directory" || { failed=1; break; }
    temporary="$target_directory/.AtalhosAE-install-$$-$i.tmp"
    if ! /bin/cp "${sources[$i]}" "$temporary" || [ "$(file_hash "$temporary")" != "${hashes[$i]}" ]; then
      [ ! -f "$temporary" ] || /bin/rm -f "$temporary"
      failed=1; break
    fi
    /bin/chmod 644 "$temporary" || { failed=1; break; }
    /bin/mv -f "$temporary" "$target_file" || { failed=1; break; }
    written+=("$i")
    [ "$(file_hash "$target_file")" = "${hashes[$i]}" ] || { failed=1; break; }
  done
  if [ "$failed" -ne 0 ]; then
    for index in "${written[@]}"; do
      target_file="${targets[$index]}"
      # Do not overwrite an unrelated edit that happened during installation.
      [ "$(file_hash "$target_file")" = "${hashes[$index]}" ] || continue
      if [ -n "${backups[$index]}" ]; then /bin/cp -p "${backups[$index]}" "$target_file" || true
      else /bin/rm -f "$target_file"; fi
    done
    fail "A instalacao foi interrompida. Confira o backup em $backup antes de tentar novamente."
    return 1
  fi
  printf '\nInstalado! Backup: %s\n' "$backup"
  printf '%s\n' 'Abra o After > Janela > Atalhos AE.' 'N (uma vez): editor de atalhos > zz Atalhos AE - NULL > atribua N e remova o conflito do N original.'
  printf '%s\n' 'Sem mudancas em projetos, atalhos, Gatekeeper ou arquivos internos do After.' 'Letras dinamicas usam sliders nativos se o controle agrupado nao estiver registrado.'
}

main() {
  [ "$(/usr/bin/uname -s)" = Darwin ] || { fail 'No Windows, use INSTALAR.bat.'; return 1; }
  if [ "${1:-}" = '--copy-owned' ]; then
    [ "$#" -eq 4 ] || return 1
    copy_owned_files "$2" "$3" "$4"
    return $?
  fi
  local source app='' parent base result
  source="$(cd -P "$(dirname "$0")" && pwd)" || return 1
  if /usr/bin/pgrep -x 'After Effects' >/dev/null 2>&1; then fail 'Salve o trabalho e feche o After Effects antes de instalar.'; return 1; fi
  if [ "$#" -eq 2 ] && [ "$1" = '--after-effects-app' ]; then app="$2"
  else
    # Product-year folder names sort naturally. Prefer latest stable, not Beta.
    for candidate in /Applications/Adobe\ After\ Effects*/*.app; do
      [ -d "$candidate/Contents" ] || continue
      case "$candidate" in *Beta*|*beta*) continue;; esac
      app="$candidate"
    done
  fi
  if [ -z "$app" ]; then
    app="$(/usr/bin/osascript -e 'POSIX path of (choose application with prompt "Selecione o Adobe After Effects para instalar Atalhos AE" as alias)' 2>/dev/null)" || return 1
    app="${app%/}"
  fi
  [ -d "$app/Contents" ] || { fail 'After Effects nao encontrado. Instale o aplicativo primeiro.'; return 1; }
  base="$(cd -P "$(dirname "$app")" && pwd)" || return 1
  printf 'Atalhos AE — %s\n' "$(basename "$base")"
  printf '%s\n' 'Instala somente os arquivos do painel. Nao precisa de Node, Homebrew ou extratores.'
  if [ -w "$base" ] && { [ ! -e "$base/Scripts" ] || [ -w "$base/Scripts" ]; }; then
    copy_owned_files "$source" "$app" "$HOME"
    return $?
  fi
  # Adobe's /Applications directory may need one normal macOS administrator
  # confirmation. quoted form of protects spaces, accents and shell symbols.
  /usr/bin/osascript - "$source/INSTALAR.command" "$source" "$app" "$HOME" <<'APPLESCRIPT'
on run argv
    set commandText to "/bin/bash " & quoted form of (item 1 of argv) & " --copy-owned " & quoted form of (item 2 of argv) & " " & quoted form of (item 3 of argv) & " " & quoted form of (item 4 of argv)
    return do shell script commandText with administrator privileges
end run
APPLESCRIPT
}

main "$@"
result=$?
pause_if_interactive
exit "$result"
