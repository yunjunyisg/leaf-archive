修复识植助手 1.0.0 通过 current 符号链接启动时直接退出的问题。已验证真实进程能通过该路径启动并响应本机健康检查，12 项自动测试通过。安装时先通过健康检查再设为开机自启，失败时输出进程状态并回滚服务配置。

首次安装失败可直接安装本包。[中文安装步骤](https://github.com/yunjunyisg/leaf-archive/blob/main/docs/plant-id-web.md)
