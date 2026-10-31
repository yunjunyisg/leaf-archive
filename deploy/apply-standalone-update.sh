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
for name in server.mjs global-boundaries.mjs taxonomy.mjs profile.mjs profile-page.html profile-client.js account-ui.mjs account-ui.js account-deletion.mjs filing.mjs storage.mjs local-auth.mjs access.mjs admin.mjs admin-account.mjs admin-page.html admin-client.js; do
    test -f "$source_dir/$name" || { echo '更新文件不完整，尚未修改服务器。'; exit 1; }
done
core_source="$update_root/dist/server/index.js"
core_target=/opt/leaf-archive/dist/server/index.js
has_core=0
if [ -d "$update_root/dist" ]; then
    test -f "$core_source" || { echo '页面及接口更新文件不完整，尚未修改服务器。'; exit 1; }
    test -f "$core_target"
    /usr/bin/node --check --input-type=module < "$core_source"
    has_core=1
fi
if [ ! -f "$source_dir/boundary-data/catalog.json" ]; then
    test -f "$update_root/required-boundaries.json" || { echo '缺少全球地图边界数据，请使用完整更新包。'; exit 1; }
    /usr/bin/node --input-type=module - "$update_root/required-boundaries.json" "$target_dir/boundary-data" <<'JS'
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';
try{
 const files=JSON.parse(readFileSync(process.argv[2],'utf8')).files;if(!files||!files['catalog.json']||Object.keys(files).length<2)throw Error();
 for(const [name,hash] of Object.entries(files)){
  if(!/^(catalog\.json|[A-Z]{2}-ADM[23]\.json\.gz)$/.test(name)||!/^[a-f0-9]{64}$/.test(hash))throw Error();
  if(createHash('sha256').update(readFileSync(path.join(process.argv[3],name))).digest('hex')!==hash)throw Error();
 }
 console.log('现有全球地图边界校验通过，本次保留边界文件。');
}catch{console.error('现有全球地图版本不符、文件缺失或校验失败，尚未修改程序。请先安装完整全球地图更新包。');process.exit(1)}
JS
fi
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
core_backup="$backup_dir-core.js"
if [ "$has_core" -eq 1 ]; then cp -a "$core_target" "$core_backup"; fi
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
            if [ -d "$file" ] && [ -d "$target_dir/$name" ]; then
                find "$target_dir/$name" -depth -delete
            elif [ ! -e "$backup_dir/$name" ]; then
                rm -f -- "$target_dir/$name"
            fi
        done
        cp -a "$backup_dir/." "$target_dir/"
        if [ "$has_core" -eq 1 ]; then cp -a "$core_backup" "$core_target"; fi
        if [ "$was_active" -eq 1 ]; then systemctl restart leaf-archive || true; fi
        echo '更新检查失败，已恢复旧程序。数据库没有回滚，原有数据和已创建账号均保留。'
    fi
    exit "$result"
}
trap rollback EXIT
systemctl stop leaf-archive
changed=1
cp -a "$source_dir/." "$target_dir/"
if [ "$has_core" -eq 1 ]; then
    cp -a "$core_source" "$core_target"
    chown root:www "$core_target"
    chmod 640 "$core_target"
fi
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
