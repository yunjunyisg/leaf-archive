# 管理员专用界面更新

目标主站：https://gloriouscarnivorousplants.top。管理员账号仅提供数据统计、账号管理、用户总植物地图，没有个人收藏和分类树入口。普通用户界面不变。

本更新同时保留备案号、注册、账号注销和重置密码后强制改密功能。总地图沿用服务器现有地图组件及边界资源，不要求重新构建整个网站。

## 安装更新



下载本次管理员专用界面更新的固定版本源码包，文件名为 `leaf-archive-admin-console-20261030-v1.zip`，与之前的源码包区分：
https://github.com/yunjunyisg/leaf-archive/archive/refs/tags/admin-console-20261030-v1.zip

上传为 `/root/leaf-migration/leaf-archive-admin-console-20261030-v1.zip`，在服务器终端执行以下命令。仅提取独立运行层和更新脚本，不导入仓库中的历史备份，不重新创建管理员。

```bash
(
set -e
umask 077
cd /root/leaf-migration
python3 - <<'PYTHON'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
root = Path('/root/leaf-migration/admin-console-update')
with ZipFile('leaf-archive-admin-console-20261030-v1.zip') as archive:
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
bash admin-console-update/deploy/apply-standalone-update.sh
)
```

更新会短暂停止服务并自动检查健康状态，原有账号、管理员角色、档案和照片保留。完成后重新登录管理员账号，后台仅显示数据统计、账号管理和用户总植物地图；源码推送不等于服务器已安装。
