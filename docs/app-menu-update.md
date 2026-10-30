# 软件内安装菜单修复

用户已取消苹果版开发。本次仅修复现有 Windows、安卓软件中的重复安装选项，不重新生成软件安装包。

软件内隐藏“添加到桌面”按钮和安装弹窗；普通浏览器保留该功能。兼容现有软件及已添加到桌面的网页应用。安装网站补丁后重新打开软件即可生效，账号及档案保留。

下载 [网站更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/app-menu-20261031-v1/leaf-archive-app-menu-20261031-v1.tar.gz)，上传到 `/root/leaf-migration/` 后，在服务器终端运行：

```bash
install -d -m 700 /root/leaf-migration/app-menu-update
tar -xzf /root/leaf-migration/leaf-archive-app-menu-20261031-v1.tar.gz -C /root/leaf-migration/app-menu-update
bash /root/leaf-migration/app-menu-update/deploy/apply-standalone-update.sh
```

当前环境不能直接操作目标服务器，源码同步与补丁发布不代表已经安装到线上。
