# 植藏 · 私人植物档案

中文植物收藏记录网站，支持检索、科属分类树、照片导入、植物档案与养护日志。

线上网站：https://leaf-archive-oct03.giving-rook-4847.chatgpt.site （需要以网站所有者身份登录）

## 功能

- 中文名、学名、收藏编号、来源编号、购入来源、价格与日期
- 产地、个体信息、简介、摆放位置、养护需求及备注
- 多张照片导入，卡片与列表视图，关键词检索与筛选
- 养护日期、生长日志、来源汇总与 JSON 档案导出
- Cloudflare D1 保存档案，R2 保存上传图片；按用户隔离数据

## 本地预览

需要 Node.js 22 或更高版本。

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --file drizzle/0000_harsh_ben_parker.sql
npm run dev
```

打开 Wrangler 输出的本地地址可浏览示例档案。保存个人档案的 API 需要认证用户身份：生产网站由 Sites 注入可信的 `oai-authenticated-user-id` 请求头。本地接口调试可以手动设置此请求头；自行部署时需要通过可信认证层设置，并过滤客户端伪造的身份头。

## 目录

- `public/`：页面、样式、交互脚本、示例照片与来源信息
- `worker/index.js`：页面及 API，访问 D1 和 R2
- `db/schema.ts`、`drizzle/`：数据库定义与迁移
- `scripts/build.mjs`：打包 Cloudflare Worker
- `wrangler.jsonc`：本地预览配置

## 部署说明

原网站继续由 Sites 托管。此仓库保存源码，不会自动更改线上网站。`.openai/hosting.json` 保留逻辑存储绑定，不包含原网站标识；`wrangler.jsonc` 中数据库标识用于本地预览，自行部署时需配置自己的 D1、R2 和认证层。

个人植物记录与上传照片的本次备份位于 `backups/personal/`，仅应保存在私有仓库。仓库不包含运行凭据或本地测试数据。示例照片及其署名、来源和许可信息见 `public/credits.json`；请遵守各照片对应的许可。
