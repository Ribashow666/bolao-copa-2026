#!/usr/bin/env bash
# Gera o APK do Bolão Muita Paz (Git Bash).  Uso: ./build.sh <versao>   ex: ./build.sh 4
# Só precisa rodar de novo se mudar o app em si (ícone, nome, Java). Mudança no SITE não precisa de APK novo.
# A versão tem que ser maior que a do APK anterior, senão não instala por cima.
set -euo pipefail
cd "$(dirname "$0")"

VERSAO="${1:?informe a versão, ex: ./build.sh 4}"
GRADLE="${GRADLE:-/c/Users/guilh/Android/gradle-8.10.2/bin/gradle}"

# Chave de assinatura: já existe (criada na v1). NUNCA trocar, senão o APK novo não instala por cima do antigo.
[ -f bolao-release.jks ] && [ -f keystore-senha.txt ] || { echo "Falta bolao-release.jks / keystore-senha.txt"; exit 1; }

"$GRADLE" --console=plain -q assembleRelease -Pversao="$VERSAO"
cp build/outputs/apk/release/BolaoMuitaPaz-release.apk BolaoMuitaPaz.apk 2>/dev/null \
  || cp build/outputs/apk/release/*-release.apk BolaoMuitaPaz.apk
echo "OK: $(pwd)/BolaoMuitaPaz.apk (versão 1.$VERSAO)"
