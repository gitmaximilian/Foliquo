#!/usr/bin/env bash
# Installs LibreOffice Writer on GitHub-hosted Ubuntu runners. Each attempt is time-limited so a
# stalled package mirror cannot hang the job; attempts alternate between the HTTPS Ubuntu archive
# and the runner's default Azure mirror.
set -u
# Extra packages may be passed as arguments; LibreOffice Writer is always installed.
packages=(libreoffice-writer "$@")
opts=(-o Acquire::Retries=2 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)
sources=$(ls /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list 2>/dev/null || true)
use_mirror() {
  for file in $sources; do
    if [ "$1" = archive ]; then
      sudo sed -i 's|http://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$file"
    else
      sudo sed -i 's|https://archive.ubuntu.com/ubuntu|http://azure.archive.ubuntu.com/ubuntu|g' "$file"
    fi
  done
}
for mirror in archive azure archive; do
  use_mirror "$mirror"
  echo "Installing ${packages[*]} via the $mirror mirror"
  if timeout 600 sudo apt-get "${opts[@]}" update && timeout 900 sudo apt-get "${opts[@]}" install -y --no-install-recommends "${packages[@]}"; then
    exit 0
  fi
  echo "::warning::LibreOffice installation via the $mirror mirror did not finish; trying the next mirror."
  sudo dpkg --configure -a || true
done
echo "::error::LibreOffice Writer could not be installed from any mirror."
exit 1
