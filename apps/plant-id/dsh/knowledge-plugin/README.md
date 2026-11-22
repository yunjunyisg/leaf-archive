# 识植助手 MCP 插件

把识植助手接入支持远程 MCP 的 AI 客户端，并在原来的聊天窗口完成植物识别和问答。AI 账号与模型用量继续由用户自己的客户端管理。连接此只读插件无需识植助手账号或额外 API Key。

## 连接

在 AI 客户端的 MCP、扩展或连接器设置中新增「识植助手」，选择 Streamable HTTP，再填写服务器地址。

```text
https://gloriouscarnivorousplants.top/plant-id/mcp
```

需要 JSON 配置的客户端可参考 `mcp.json`，把 `plant_id` 条目加入客户端现有配置。各客户端的自定义连接权限和配置格式以自身设置为准。有些客户端只显示工具，不单独提供提示菜单。

## 在对话中使用

- 上传植物照片后问「用识植助手鉴别这株植物，给我候选和最有用的补拍建议」。
- 也可以问「用识植助手核对 Dionaea corymbosa 的接受名，并给出原始来源」。
- 有提示菜单的客户端可选「识别植物」或「植物问答」。客户端也可以直接调用 `plant_agent` 或 `lookup_plant`。
- 当前 AI 需支持图片理解才能看图；也可用文字描述。照片由该 AI 客户端读取，发送给插件的资料查询参数只包含候选名称。插件只能访问站点的公开植物索引。

## 在 DeepSeek Harness 中加载

需要支持 `@deepseek-ai/dsh-mcp-client` 及 Streamable HTTP 的 DSH。把 `cordis.patch.yml` 保存到本机，再用已有模型配置运行：

```bash
dsh --profile headless --patch /absolute/path/to/cordis.patch.yml "请用识植助手核对 Dionaea corymbosa 的接受名，并列出资料出处"
```

之前已连接共享植物资料库的 DSH 用户可继续使用原来的连接地址。服务器升级后，刷新工具列表或重新连接即可看到新工具。
