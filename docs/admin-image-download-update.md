# 管理员图片下载更新

目标主站：https://gloriouscarnivorousplants.top。

## 修改内容

- 删除管理后台顶部两处“植藏”文字刷新链接，保留“刷新数据”；普通用户页面不变。
- “账号管理”中增加“用户上传图片”，涵盖植物照片、日志照片、分类参考图；每页三十张，支持翻页和逐张下载原图。
- 点击账号的“查看档案”同时筛选该用户的图片；“查看全部用户”恢复全部图片。
- 档案详情中的上传照片也显示“下载原图”。
- 图片列表及下载必须经过服务端管理员角色和会话验证，响应使用私有、禁止缓存策略。普通账号不能下载他人图片；注销后相关图片不再列出或允许下载。
- 本次完整包同时包含上一版的杂交种、分类树编辑及删除功能；不包含数据库、个人图片或凭据。

## 安装

下载[完整更新包](https://github.com/yunjunyisg/leaf-archive/releases/download/admin-images-20261031-v1/leaf-archive-admin-images-20261031-v1.tar.gz)，上传到服务器 `/root/leaf-migration/`，执行：

```bash
install -d -m 700 /root/leaf-migration/admin-images-update
tar -xzf /root/leaf-migration/leaf-archive-admin-images-20261031-v1.tar.gz -C /root/leaf-migration/admin-images-update
bash /root/leaf-migration/admin-images-update/deploy/apply-standalone-update.sh
```

更新脚本备份程序，检查失败会恢复旧程序，不覆盖用户数据库及照片。安装完成后刷新后台；Windows、安卓软件无需重装。

源码发布和服务器安装是两个步骤。本次环境没有目标服务器的执行连接，需要在服务器安装更新后才会生效。已通过七十六项自动测试；尚未在目标服务器或实际手机上验收下载操作。
