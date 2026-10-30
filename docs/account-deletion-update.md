# 注销账号与数据删除更新

目标主站：https://gloriouscarnivorousplants.top。

- 管理员注销普通账号时删除该账号的档案、生长记录、分类、产地坐标、照片及身份关联，并撤销全部登录；后台总地图和列表不再展示该用户的档案。
- 用户可从收藏页顶部“注销账号”进入 `/account/delete`，验证当前密码并输入账号及“确认注销”，仅删除自身账号。
- 操作前明确确认，网站内不能恢复。管理员不可注销；新用户、其他用户数据不受影响。安装程序不会自动注销任何账号，也不会自动清空旧版本已禁用账号的数据；管理员可明确选择清理。
- 清理照片失败或数量较大时，持久队列在后台重试，删除后的记录不能被并发旧请求重新写入。
- 保留备案号、多人注册、重置密码后强制改密及管理员专用总地图。更新包仅升级程序，不重新导入历史备份，不创建或重置账号。

## 安装更新




下载本次注销与数据删除更新的固定版本源码包，文件名为 `leaf-archive-account-deletion-20261030-v1.zip`，与之前的源码包区分：
https://github.com/yunjunyisg/leaf-archive/archive/refs/tags/account-deletion-20261030-v1.zip

上传为 `/root/leaf-migration/leaf-archive-account-deletion-20261030-v1.zip`，在服务器终端执行以下命令。仅提取独立运行层和更新脚本，不导入仓库中的历史备份，不重新创建管理员。

```bash
(
set -e
umask 077
cd /root/leaf-migration
python3 - <<'PYTHON'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
root = Path('/root/leaf-migration/account-deletion-update')
with ZipFile('leaf-archive-account-deletion-20261030-v1.zip') as archive:
    for item in archive.infolist():
        parts = PurePosixPath(item.filename).parts
        if item.is_dir() or len(parts) < 3:
            continue
        relative = PurePosixPath(*parts[1:])
        if '..' in relative.parts:
            raise SystemExit('压缩包路径异常，已停止')
        if relative.parts[0] == 'standalone' or str(relative) == 'deploy/apply-standalone-update.sh':
            target = root.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))
PYTHON
bash account-deletion-update/deploy/apply-standalone-update.sh
)
```

更新会短暂停止服务并自动检查健康状态，原有账号、管理员角色、档案和照片保留。完成后普通用户页面顶部可见“注销账号”，管理员注销提示会明确说明删除数据；源码推送不等于服务器已安装。
