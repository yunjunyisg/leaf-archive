# 双端“我的”页面更新

主站：https://gloriouscarnivorousplants.top。

## 功能

- 手机软件删除原生顶部操作栏；网页手机端也不再显示额外账号操作栏。点击“植藏”标识刷新当前页面。
- 电脑、手机共用 `/account` 的“我的”页面，侧栏和导航均有入口。
- 用户名为显示名称，可用中文；登录账号保持不变。显示名称和头像保存在服务器，其他设备再次打开或刷新后读取最新资料。
- 普通用户可查看本人全部档案的购入总额、科属数量及分类分布，不含示例和其他用户数据。原收藏页的购入总额及分类概况移到此处；分类树仍可通过入口访问。
- “退出账号”撤销当前登录会话，不删除数据；“退出应用”只在新版软件内显示，关闭软件并保留登录。普通浏览器直接关闭页面即可离开。
- 保留用户自行注销入口，注销会删除该用户的档案、分类、头像和照片。管理员可编辑个人资料及退出，个人收藏接口仍受限制。

头像由前端裁切缩小后上传，后端限制大小和图片格式，头像读取只允许当前账号。替换时清理旧文件，注销时连同该用户文件一并清理。

## 更新顺序

先安装网站更新包，再安装两端软件。软件只连接主站，不会自动安装网站接口。

在 [本次下载页](https://github.com/yunjunyisg/leaf-archive/releases/tag/apps-v1.1.0) 下载 `leaf-archive-profile-20261030-v1.tar.gz`，上传至服务器 `/root/leaf-migration/`，在服务器终端运行：

```bash
install -d -m 700 /root/leaf-migration/profile-update
tar -xzf /root/leaf-migration/leaf-archive-profile-20261030-v1.tar.gz -C /root/leaf-migration/profile-update
bash /root/leaf-migration/profile-update/deploy/apply-standalone-update.sh
```

更新脚本备份旧运行层、短暂停止服务、升级并检查健康状态；既有账号和档案保留，不重新导入历史备份。新增个人资料表，不改动既有迁移文件。

随后安装 `LeafArchive-Android-1.1.0.apk`，原用户可直接覆盖安装，签名保持一致。电脑用户关闭旧程序，解压新版 `LeafArchive-Windows-x64-1.1.0.exe`，运行其中的 `LeafArchive.exe`。两端都使用原网站账号。

源码同步、安装包发布及服务器实际安装是不同步骤。本次构建环境未配置直接操作目标服务器的连接；服务器安装后才能验收新页面。
