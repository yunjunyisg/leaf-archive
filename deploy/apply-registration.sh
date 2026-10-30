#!/usr/bin/env bash
set -euo pipefail
umask 077
if [ "$(id -u)" -ne 0 ]; then
    echo '请在服务器管理员终端运行此更新。'
    exit 1
fi
update_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
target=/opt/leaf-archive/standalone/local-auth.mjs
payload="$update_dir/standalone/local-auth.mjs"
test -f "$target"
test -f "$payload"
test -f /var/lib/leaf-archive/archive.sqlite
id www >/dev/null
systemctl cat leaf-archive >/dev/null
/usr/bin/node --check "$payload"
printf '%s  %s\n' 'a73af88caf9919e74c645fe5b2aa6c073da1920641cb4141dc3adb5fb902aaae' "$payload" | sha256sum --check --status
current_sha=$(sha256sum "$target" | cut -d ' ' -f 1)
case "$current_sha" in
    a73af88caf9919e74c645fe5b2aa6c073da1920641cb4141dc3adb5fb902aaae|236225c32844baadc349bbfeda112a7f52b6df6ad47f3569377bd0b1170635f5|984ab688557e33c4ceb9cef890d8c36ab3fc339bd555c18bbf7d0833b18da5e8|f8414c0ea42a0b6b98dffa8a7e5591dcdbbfb888ef7cabb038d219f08f52b64b) ;;
    *) echo '现有登录模块与已验证版本不同，已停止，尚未修改任何文件。'; exit 1 ;;
esac
backup_dir=/root/leaf-migration/module-backups
install -d -m 700 "$backup_dir"
backup="$backup_dir/local-auth.$(date +%Y%m%d-%H%M%S).$$.mjs"
cp -p "$target" "$backup"
chmod 600 "$backup"
pending="${target}.pending.$$"
changed=0
rollback() {
    result=$?
    trap - EXIT
    rm -f -- "$pending"
    if [ "$result" -ne 0 ] && [ "$changed" -eq 1 ]; then
        install -o root -g www -m 640 "$backup" "$pending"
        mv -f -- "$pending" "$target"
        systemctl restart leaf-archive || true
        echo '更新检查失败，已恢复更新前的登录模块；数据库和原账号未被覆盖。'
    fi
    exit "$result"
}
trap rollback EXIT
install -o root -g www -m 640 "$payload" "$pending"
mv -f -- "$pending" "$target"
changed=1
systemctl restart leaf-archive
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:3100/healthz
printf '\n'
curl --fail --silent --show-error http://127.0.0.1:3100/auth/register --output /dev/null
changed=0
echo '多人注册功能已启用，已有账号、档案和照片均保留。'
echo '注册页面：https://gloriouscarnivorousplants.top/auth/register'
