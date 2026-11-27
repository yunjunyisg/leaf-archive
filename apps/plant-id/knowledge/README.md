# 识植助手植物资料库

## 全球植物名录

World Flora Online 2026-06 的 CC0 名录已导入只读 SQLite 索引，包含 382,386 个接受种名、16,252 个接受属名、738 个接受科名及 608,087 条已解析异名关联。范围涵盖被子植物、裸子植物、蕨类、石松类及苔藓类等。保留原始名录编号。疑难名和同名歧义不强行归并。名录主要提供学名、科属和异名。识别结果中的中文植物描述为模型整理，另列可匹配的维基百科原文节选及出处。[World Flora Online 2026-06 数据发布](https://doi.org/10.5281/zenodo.20782718)

全球索引使用独立只读数据库和有限页缓存。打包时展开版本化的公开数据文件。安装程序同时校验数据库文件，启动时按需查询，不把整个名录读进内存。开发环境执行 `npm start` 或 `npm test` 时会自动生成并检查本地索引。

### 重建全球索引

下载钉定版本的 `_DwC_backbone_R.zip`，然后在仓库根目录执行：

```bash
python3 scripts/import-plant-id-world-flora.py /path/to/_DwC_backbone_R.zip
npm test --prefix apps/plant-id
```

导入器校验发布包摘要、索引记录量和 SQLite 完整性。更新到其他 WFO 版本时，同步调整版本、来源与摘要。需保留压缩全球索引和来源清单，展开后的数据库只进入服务器包。

## 食虫植物补充资料

`snapshot.json` 是随服务器安装包发布的只读快照。软件启动时加载快照。植物识别每轮仍调用一次视觉模型。提示中加入四组食虫植物属的形态核对要点，并按用户提到的学名或上一轮候选提供本地分类条目。匹配的候选也会显示接受名、异名、科名和相关来源。图库的玩家实拍用于人工对照和来源展示。

## 来源

- 接受名、属种层级和异名来自 GBIF Backbone Taxonomy，CC BY 4.0。快照按所选食虫植物属导入，保留原始 GBIF 分类编号。[GBIF Backbone Taxonomy](https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c)
- 捕蝇草属、猪笼草属、瓶子草属和狸藻属的形态要点据北卡罗来纳州立大学推广植物资料库整理。[捕蝇草](https://plants.ces.ncsu.edu/plants/dionaea-muscipula/) · [猪笼草](https://plants.ces.ncsu.edu/plants/nepenthes/) · [瓶子草](https://plants.ces.ncsu.edu/plants/sarracenia/) · [狸藻](https://plants.ces.ncsu.edu/plants/utricularia/)
- 社区样例取自通过 GBIF 发布的 iNaturalist 研究级观察及 Pl@ntNet 观察。抽取有图片且与 GBIF 种编号匹配的开放许可条目，快照仅记录平台、许可和原始观察编号。观测记录与媒体分别适用各自的许可。应用现有参考照片功能另从 iNaturalist 挑选适用许可的图片并标注作者。[iNaturalist 数据集](https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7) · [Pl@ntNet 数据集](https://www.gbif.org/dataset/7a3679ef-5582-4aaa-81f0-8c2545cafc81)

## 刷新数据

在仓库根目录运行：

```bash
python3 scripts/refresh-plant-id-knowledge.py
npm test --prefix apps/plant-id
```

导入范围由 `seed.json` 控制。导入器通过公开接口分页查询，筛选结果通过完整性校验后才替换快照。提交更新后的快照并重新打包，即可部署。快照只包含公开分类、观察编号和许可资料。应用不会从识别请求读取或上传植藏收藏库。

本版本提供学名覆盖和来源核验。识别准确率需要用有专家标签、与资料库来源分离的照片集测量。

## 问答资料与图片

所有名录中可核对的学名使用同一套按名称检索的流程。问答优先使用本地 WFO 名录，再向邱园 POWO 核对接受名、发表信息与物种备注，向中国科学院植物研究所植物智核对有对应条目的中文名，并在 iNaturalist 的学名条目有对应维基百科摘要时读取该摘要。每次查询仅发送公开学名。已核对的邱园和植物智事实写入站内 SQLite 缓存，按使用更新。植物智原文不批量镜像。专题描述、命名释义与开放图片的可用程度因物种而异。 [邱园 POWO](https://powo.science.kew.org/) · [植物智](https://www.iplant.cn/newsinfo/56)

`species-notes.json` 保存有出处的专题事实和可离线提供的图。首批资料包括 Allen Lowrie 1994 年发表的 `Drosera ordensis` 原始描述。两张 Wikimedia Commons 图片的作者、许可、来源与缩放说明和图片一同发布。图库还会按候选学名查询 iNaturalist 的开放授权照片，并排除物种不匹配和许可不符的记录。没有可用观察图时，尝试精确学名百科条目所用的 Wikimedia Commons 开放许可图片。 [原始分类描述](https://doi.org/10.58828/nuy00212) · [Wikimedia Commons 图片分类](https://commons.wikimedia.org/wiki/Category:Drosera_ordensis)
