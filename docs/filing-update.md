# 备案号页脚更新

当前主站：https://gloriouscarnivorousplants.top。首页、登录、注册、修改密码和管理员页面底部显示 `蜀ICP备2026066760号`，链接到 https://beian.miit.gov.cn/ 。保留用户提供的样式，并为新窗口链接加上安全属性。

仅修改 GitHub 源码不会自动安装到阿里云服务器；本更新包含页面兼容处理，不需要在服务器重新构建整个网站。更新也保留之前的账号管理功能。

## 安装更新


下载本次备案号更新的固定版本源码包，文件名为 `leaf-archive-filing-20261030-v1.zip`，与之前的源码包区分：
https://github.com/yunjunyisg/leaf-archive/archive/refs/tags/filing-20261030-v1.zip

上传为 `/root/leaf-migration/leaf-archive-filing-20261030-v1.zip`，在服务器终端执行以下命令。仅提取独立运行层和更新脚本，不导入仓库中的历史备份，不重新创建管理员。

```bash
(
set -e
umask 077
cd /root/leaf-migration
python3 - <<'PYTHON'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
root = Path('/root/leaf-migration/filing-update')
with ZipFile('leaf-archive-filing-20261030-v1.zip') as archive:
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
bash filing-update/deploy/apply-standalone-update.sh
)
```

更新会短暂停止服务并自动检查健康状态，原有账号、管理员角色、档案和照片保留。完成后刷新网站首页和登录页面即可看到备案号；源码推送不等于服务器已安装。
