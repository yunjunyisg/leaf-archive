修复手机端找不到“退出登录”的问题。

- 安卓：下载 `LeafArchive-Android-1.0.1.apk` 覆盖安装，无需卸载。顶部新增固定“退出登录”按钮，确认后撤销当前会话并返回登录页；网络失败会提示重试。签名与原版一致。
- 手机浏览器：下载 `leaf-archive-mobile-logout-20261030-v1.tar.gz`，由服务器管理员安装后刷新网站。修复窄屏隐藏顶部账号栏的问题，不需要重新构建整个网站。
- 网站包保留既有账号、档案和照片，不重设密码、不重新导入历史备份。

验证：网站六十一项测试通过，包括普通账号及管理员退出后的旧会话失效；安卓构建成功、静态检查无错误、签名验证通过。尚未在用户实际手机上完成验收。

[网站安装步骤](https://github.com/yunjunyisg/leaf-archive/blob/main/docs/mobile-logout-update.md)

[Windows 版沿用原版](https://github.com/yunjunyisg/leaf-archive/releases/download/apps-v1.0.0/LeafArchive-Windows-x64-1.0.0.exe)
