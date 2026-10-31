# 行政分区概览快照

这些边界仅用于交互式产地概览，不是测绘、采集或法律边界依据。分类着色来自当前账号已经标注的植物档案，不能解释为物种完整野生分布范围。

- `admin1.json.gz`：Natural Earth 1:10m admin-1，公有领域。保留 4,584 个省州级分区、240 个国家/地区代码及多语言名称别名。按 0.015 度容差简化并四舍五入至四位小数，海岸小岛和边界存在概览误差，不能用于小地名测量。来源：https://github.com/nvkelso/natural-earth-vector 。许可：https://www.naturalearthdata.com/about/terms-of-use/ 。
- `US-counties.json.gz`：us-atlas 3.0.1 的 counties-10m TopoJSON，基于美国人口普查局 2017 年制图边界（并非实时行政调整）。来源：https://github.com/topojson/us-atlas 。软件许可为 ISC，见网站 `/map-licenses.txt`。
- `AU-admin2.json.gz`：geoBoundaries gbOpen `AUS-ADM2-25037944`，上游来源 Australian Bureau of Statistics，CC BY 4.0。包含 547 个地方政府区，保留名称并按同样容差简化。数据版本为 geoBoundaries 提交 `9469f09`，不保证反映最新行政调整。元数据：https://www.geoboundaries.org/api/current/gbOpen/AUS/ADM2/ 。许可：https://creativecommons.org/licenses/by/4.0/ 。请引用 geoBoundaries：Runfola et al. (2020), geoBoundaries: A global database of political administrative boundaries, PLoS ONE 15(4): e0231866, https://doi.org/10.1371/journal.pone.0231866 。

快照日期、上游 URL 和 SHA-256 见 `metadata.json`。运行 `python3 scripts/update-map-boundaries.py` 显式更新；脚本可复用其指定 `/tmp/leaf-*.json` 下载缓存。前端只在切换分区时读取站内压缩快照，不下载全世界行政区明细。

分区关联优先使用档案中同一国家的行政区名称（含支持的别名）；名称不唯一时，再用已知坐标判定。国家代表点不推断省州；省州代表点、城市代表点不推断具体县。无法关联时保留原始标点并报告数量，不批量改写用户档案。全球细分区现已扩展到 179 个国家或地区的二级行政区、81 个的三级行政区；未覆盖项不推断，详见 `../../docs/map-coverage.md`。


## 全球二级与三级快照

`global/` 保存 geoBoundaries gbOpen 的公开简化 GeoJSON gzip 文件与 `catalog.json`。不再二次简化几何，不删除小分区，不更改用户原始坐标。各国行政级别含义不同，不能统一宣称全部是县级或乡镇级。

数据下载使用上游固定提交的 media URL；目录逐项保存来源、许可、资料年份、边界 ID、原始文件及压缩文件 SHA-256。引用 Runfola et al. (2020), PLoS ONE 15(4): e0231866。公开来源和许可说明也通过主站 `/map-boundaries/global/catalog.json` 提供，地图链接可查阅。

显式更新：`python3 scripts/update-global-boundaries.py`；默认校验并复用已有快照，`--refresh` 强制重新下载。需要 Node 项目依赖以解析 ISO-3166 代码；下载失败会记录到目录并非零退出，不能当作完整覆盖。AU、US 保留既有二级快照。

独立站按国家和层级读取本地 gzip，不向海外临时请求边界；服务端仅保留少量完整性校验元数据，内容按请求流式读取，前端只保留最近两个数据请求。数据随完整更新包复制到 `standalone/boundary-data/`，不嵌进编译模块，也不放进个人图片目录。Worker 历史部署仅保留旧静态边界，不作为本次上线目标。
