识植助手增加「植物问答」窗口和候选卡片的追问入口。后台使用 DeepSeek Harness，用户在当前窗口输入自己的 DeepSeek 开放平台 API Key，使用各自的额度。问答使用共享只读植物资料并显示来源。

附带独立 DSH 知识库插件配置。安装网站更新后，还需在服务器执行 deploy/install-dsh.sh 启用问答运行时。23 项自动测试通过，另已使用真实 DSH 运行时和模拟模型接口验证网页后台调用及只读 MCP 插件。

[安装与配置说明](https://github.com/yunjunyisg/leaf-archive/blob/main/docs/plant-id-web.md)
