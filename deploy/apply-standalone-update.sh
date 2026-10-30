#!/usr/bin/env bash
set -euo pipefail
umask 077
if [ "$(id -u)" -ne 0 ]; then
    echo '请在服务器管理员终端运行此更新。'
    exit 1
fi
update_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
source_dir="$update_root/standalone"
target_dir=/opt/leaf-archive/standalone
for name in server.mjs storage.mjs local-auth.mjs access.mjs admin.mjs admin-account.mjs admin-page.html admin-client.js; do
    test -f "$source_dir/$name" || { echo '更新文件不完整，尚未修改服务器。'; exit 1; }
done
test -f "$target_dir/server.mjs"
test -f /var/lib/leaf-archive/archive.sqlite
id www >/dev/null
systemctl cat leaf-archive >/dev/null
for module in "$source_dir"/*.mjs "$source_dir"/*.js; do
    /usr/bin/node --check "$module"
done
if [ -f "$update_root/SHA256SUMS" ]; then
    (cd "$update_root" && sha256sum --check --status SHA256SUMS)
fi
backup_root=/root/leaf-migration/runtime-backups
install -d -m 700 "$backup_root"
backup_dir="$backup_root/runtime-$(date +%Y%m%d-%H%M%S)-$$"
install -d -m 700 "$backup_dir"
cp -a "$target_dir/." "$backup_dir/"
was_active=0
if systemctl is-active --quiet leaf-archive; then was_active=1; fi
changed=0
rollback() {
    result=$?
    trap - EXIT
    if [ "$result" -ne 0 ] && [ "$changed" -eq 1 ]; then
        systemctl stop leaf-archive || true
        for file in "$source_dir"/*; do
            name=$(basename -- "$file")
            if [ ! -e "$backup_dir/$name" ]; then rm -f -- "$target_dir/$name"; fi
        done
        cp -a "$backup_dir/." "$target_dir/"
        if [ "$was_active" -eq 1 ]; then systemctl restart leaf-archive || true; fi
        echo '更新检查失败，已恢复旧程序。数据库没有回滚，原有数据和已创建账号均保留。'
    fi
    exit "$result"
}
trap rollback EXIT
systemctl stop leaf-archive
changed=1
cp -a "$source_dir/." "$target_dir/"
chown -R root:www "$target_dir"
find "$target_dir" -type d -exec chmod 750 {} +
find "$target_dir" -type f -exec chmod 640 {} +
if [ "${1:-}" = '--create-admin' ]; then
    echo '请设置管理员账号及密码，密码不会显示。'
    runuser -u www -- env LEAF_DATA_DIR=/var/lib/leaf-archive /usr/bin/node "$target_dir/admin-account.mjs"
fi
systemctl start leaf-archive
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:3100/healthz
printf '\n'
curl --fail --silent --show-error http://127.0.0.1:3100/auth/register --output /dev/null
changed=0
echo '网站程序已更新，原账号、档案和照片均保留。'
if [ "${1:-}" = '--create-admin' ]; then
    echo '管理员已配置。登录入口：https://gloriouscarnivorousplants.top/auth/local'
    echo '后台地址：https://gloriouscarnivorousplants.top/admin'
fi
