# 识植助手植物资料库

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
