# 行政分区概览快照

这些边界仅用于交互式产地概览，不是测绘、采集或法律边界依据。分类着色来自当前账号已经标注的植物档案，不能解释为物种完整野生分布范围。

- `admin1.json.gz`：Natural Earth 1:10m admin-1，公有领域。保留 4,584 个省州级分区、240 个国家/地区代码及多语言名称别名。按 0.015 度容差简化并四舍五入至四位小数，海岸小岛和边界存在概览误差，不能用于小地名测量。来源：https://github.com/nvkelso/natural-earth-vector 。许可：https://www.naturalearthdata.com/about/terms-of-use/ 。
- `US-counties.json.gz`：us-atlas 3.0.1 的 counties-10m TopoJSON，基于美国人口普查局 2017 年制图边界（并非实时行政调整）。来源：https://github.com/topojson/us-atlas 。软件许可为 ISC，见网站 `/map-licenses.txt`。
- `AU-admin2.json.gz`：geoBoundaries gbOpen `AUS-ADM2-25037944`，上游来源 Australian Bureau of Statistics，CC BY 4.0。包含 547 个地方政府区，保留名称并按同样容差简化。数据版本为 geoBoundaries 提交 `9469f09`，不保证反映最新行政调整。元数据：https://www.geoboundaries.org/api/current/gbOpen/AUS/ADM2/ 。许可：https://creativecommons.org/licenses/by/4.0/ 。请引用 geoBoundaries：Runfola et al. (2020), geoBoundaries: A global database of political administrative boundaries, PLoS ONE 15(4): e0231866, https://doi.org/10.1371/journal.pone.0231866 。

快照日期、上游 URL 和 SHA-256 见 `metadata.json`。运行 `python3 scripts/update-map-boundaries.py` 显式更新；脚本可复用其指定 `/tmp/leaf-*.json` 下载缓存。前端只在切换分区时读取站内压缩快照，不下载全世界行政区明细。

分区关联优先使用档案中同一国家的行政区名称（含支持的别名）；名称不唯一时，再用已知坐标判定。国家代表点不推断省州；省州代表点、城市代表点不推断具体县。无法关联时保留原始标点并报告数量，不批量改写用户档案。当前县级矢量覆盖限于美国和澳大利亚。
