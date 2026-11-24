#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$(id -u)" -ne 0 ]; then
    echo '请在阿里云服务器的管理员终端运行。' >&2
    exit 1
fi

target=/opt/leaf-archive/standalone
backup_root=/root/leaf-migration/runtime-backups
version=94fd87464c99c261935bf22f15aff590d91a15c0
source_url="https://raw.githubusercontent.com/yunjunyisg/leaf-archive/$version/standalone"
files=(local-auth.mjs account-deletion.mjs launcher-page.html ui.css)
for file in "${files[@]}"; do
    test -f "$target/$file"
done
systemctl is-active --quiet leaf-archive

stage=$(mktemp -d "$target/.entry-ui.XXXXXX")
changed=0
cleanup() {
    local result=$?
    if [ "$result" -ne 0 ] && [ "$changed" -eq 1 ]; then
        local restored=1
        for file in "${files[@]}"; do
            cp -p -- "$backup/$file" "$stage/restore-$file" &&
                mv -f -- "$stage/restore-$file" "$target/$file" || restored=0
        done
        if [ "$restored" -eq 1 ] && systemctl restart leaf-archive; then
            echo "更新检查失败，已恢复旧界面。备份目录 $backup" >&2
        else
            echo "自动恢复未完成。备份目录 $backup" >&2
        fi
    fi
    rm -rf -- "$stage"
    exit "$result"
}
trap cleanup EXIT

for file in "${files[@]}"; do
    curl --fail --silent --show-error --location --retry 2 --connect-timeout 8 --max-time 30 \
        "$source_url/$file" --output "$stage/$file"
done
(cd "$stage" && sha256sum --check --status <<'SUMS'
b830b293873f6f3932e01aa438cd6aeff67d1a5180ae7b903460b2ce43ae407a  local-auth.mjs
957f76dfb801a3bb0484d4a3f0365aeea6276edf6346fb155df3cbd1fab56033  account-deletion.mjs
ac6c493751f4dd3130b2abdc8050cc58b0b27a7dfde588302630df40a8b65ceb  launcher-page.html
4393a1bf331df759d915456901ba91fe8aecf40c5880cee189d398f5fb42f04c  ui.css
SUMS
)
for file in local-auth.mjs account-deletion.mjs; do
    /usr/bin/node --check "$stage/$file"
done

install -d -m 700 "$backup_root"
backup=$(mktemp -d "$backup_root/entry-ui.XXXXXX")
for file in "${files[@]}"; do
    cp -p -- "$target/$file" "$backup/$file"
    chown --reference="$target/$file" "$stage/$file"
    chmod --reference="$target/$file" "$stage/$file"
done

changed=1
for file in "${files[@]}"; do
    mv -f -- "$stage/$file" "$target/$file"
done
systemctl restart leaf-archive
health_url=http://127.0.0.1:3100
curl --noproxy '*' -fsS --max-time 5 --retry 5 --retry-connrefused --retry-delay 1 \
    "$health_url/healthz" -o /dev/null
curl --noproxy '*' -fsS --max-time 5 "$health_url/" -o "$stage/home.html"
curl --noproxy '*' -fsS --max-time 5 "$health_url/auth/local" -o "$stage/login.html"
grep -Fq 'ui-entry-archive' "$stage/home.html"
grep -Fq 'ui-entry-recognition' "$stage/home.html"
grep -Fq '登录你的植物档案' "$stage/login.html"
if grep -Fq 'ui-auth-art' "$stage/login.html"; then exit 1; fi
echo "界面更新完成。备份目录 $backup"
