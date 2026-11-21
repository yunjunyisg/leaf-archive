# 识植助手共享植物资料库

这是 DeepSeek Harness 的只读 MCP 连接配置。加载后，DSH 可以按学名、异名或本库已有的中文名称查阅共享资料库，取得接受名、科属和原始来源。资料由网站运营者维护，部署新版资料后，已连接的用户即可查询。

网页问答由识植助手服务器运行 DSH。网站用户只需在网页输入各自的 DeepSeek 开放平台 API Key，网页路径无需安装本地插件。这个配置另外提供给想在自己的 DSH 中使用资料库的人。

## 在用户自己的 DSH 中连接

需要支持 `@deepseek-ai/dsh-mcp-client` 及 Streamable HTTP 的 DSH。可把 `cordis.patch.yml` 下载到本机，运行：

```bash
dsh --profile headless --patch /absolute/path/to/cordis.patch.yml "请用共享植物资料库核对 Dionaea corymbosa 现行接受的学名"
```

也可把配置中的 `insert` 支持项合并到自己的 DSH profile 配置。保留原有配置内容。MCP 连接本身无需 API Key，用户自己的 DSH 按原有模型配置调用。

公开工具只读取识植助手的公开分类索引和公开来源，无账号资料、私有收藏、识别上传图片或写入权限。插件不会把整套名录复制进个人记忆，也不修改其他用户的私有知识。站点完成部署后，端点为 `https://gloriouscarnivorousplants.top/plant-id/mcp`。
