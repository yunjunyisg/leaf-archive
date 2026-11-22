# 植藏与识植助手界面更新

浏览器打开主域名后，先在选择页进入植藏或识植助手。植藏的直接地址是 `/collection`，识植助手的直接地址是 `/plant-id/`。原账号按应用独立登录。安卓与 Windows 已安装客户端可继续使用，旧版安卓客户端直接跳到植藏收藏或识植助手。普通手机浏览器打开根域名仍显示选择页。部分使用安卓内嵌 WebView 的第三方应用也会进入植藏收藏。

植藏保留原有标识和开屏植物。识植助手沿用固定叶片图标。桌面使用侧边导航，手机使用底部导航。两个应用升级后重新打开即可加载新的页面。

网页备案号统一显示在页脚正中央，安卓和 Windows 客户端隐藏。

## 在阿里云安装

下载两个文件，上传到 `/root/leaf-migration/`。

- [植藏更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.17/leaf-archive-ui-update-1.8.18.tar.gz)
- [识植助手更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/plant-id-web-v1.0.17/plant-id-web-v1.0.17.tar.gz)

在 Workbench 管理员终端执行：

```bash
(
set -e
cd /root/leaf-migration
sha256sum -c <<'SUMS'
f189fda9f50fa2b7abbc576fbcd7b757af5c8d3720a85cb09f49a19b70b7ecb8  leaf-archive-ui-update-1.8.18.tar.gz
98044f18a3e22c0da9b36dc338cc798913b2502daf49df591f7fee7b9478ee17  plant-id-web-v1.0.17.tar.gz
SUMS
LEAF_DIR=$(mktemp -d /root/leaf-migration/leaf-ui.XXXXXX)
PLANT_DIR=$(mktemp -d /root/leaf-migration/plant-ui.XXXXXX)
tar -xzf leaf-archive-ui-update-1.8.18.tar.gz -C "$LEAF_DIR"
tar -xzf plant-id-web-v1.0.17.tar.gz -C "$PLANT_DIR"
(cd "$LEAF_DIR" && sha256sum --quiet -c SHA256SUMS)
(cd "$PLANT_DIR" && sha256sum --quiet -c SHA256SUMS)
bash "$LEAF_DIR/deploy/apply-standalone-update.sh"
bash "$PLANT_DIR/deploy/install.sh"
)
```

这次更新复用已装的全球地图边界和问答运行时。安装程序校验地图后才替换植藏程序，升级过程保留账号、档案、照片及现有模型配置。上线后打开域名检查应用选择，再分别打开客户端检查直接入口。
