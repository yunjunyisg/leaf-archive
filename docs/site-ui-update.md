# 植藏与识植助手界面更新

浏览器打开主域名后，先在选择页进入植藏或识植助手。植藏的直接地址是 `/collection`，识植助手的直接地址是 `/plant-id/`。原账号按应用独立登录。安卓与 Windows 已安装客户端可继续使用，植藏旧客户端通过现有应用桥跳过选择页。普通浏览器内嵌网页仍显示选择页。

植藏保留原有标识和开屏植物。识植助手沿用固定叶片图标。桌面使用侧边导航，手机使用底部导航。两个应用升级后重新打开即可加载新的页面。

## 在阿里云安装

下载两个文件，上传到 `/root/leaf-migration/`。

- [植藏更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.15/leaf-archive-ui-update-1.8.16.tar.gz)
- [识植助手更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.15/plant-id-web-v1.0.15.tar.gz)

在 Workbench 管理员终端执行：

```bash
(
set -e
cd /root/leaf-migration
sha256sum -c <<'SUMS'
ba654b1664154487b376d10bbaa00d55a4d58684444b2eb7da63bd1064feeac6  leaf-archive-ui-update-1.8.16.tar.gz
4bcd317bf02e8a2d9a15558e5894e76fc2957f0228655cae0dcee183080488cd  plant-id-web-v1.0.15.tar.gz
SUMS
LEAF_DIR=$(mktemp -d /root/leaf-migration/leaf-ui.XXXXXX)
PLANT_DIR=$(mktemp -d /root/leaf-migration/plant-ui.XXXXXX)
tar -xzf leaf-archive-ui-update-1.8.16.tar.gz -C "$LEAF_DIR"
tar -xzf plant-id-web-v1.0.15.tar.gz -C "$PLANT_DIR"
(cd "$LEAF_DIR" && sha256sum --quiet -c SHA256SUMS)
(cd "$PLANT_DIR" && sha256sum --quiet -c SHA256SUMS)
bash "$LEAF_DIR/deploy/apply-standalone-update.sh"
bash "$PLANT_DIR/deploy/install.sh"
)
```

这次更新复用已装的全球地图边界和问答运行时。安装程序校验地图后才替换植藏程序，升级过程保留账号、档案、照片及现有模型配置。上线后打开域名检查应用选择，再分别打开客户端检查直接入口。
