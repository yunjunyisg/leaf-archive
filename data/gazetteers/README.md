# 小地名数据

澳大利亚快照来自 [GeoNames AU.zip](https://download.geonames.org/export/dump/AU.zip)，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。格式说明：https://download.geonames.org/export/dump/readme.txt 。快照时间、来源校验值、记录数量及行政区映射见 `AU-metadata.json`。

`AU.ndjson.gz` 每行保留 GeoNames ID、名称、WGS84 纬度与经度、地物代码、一级/二级行政区代码和标准化的别名检索串。更新命令：`python3 scripts/update-au-gazetteer.py`。更新属于显式维护任务，不在用户搜索时下载全量数据。

地名代表点不等同于植物采集坐标。GeoNames 数据以现状提供，不保证完整性或测量精度。Kingston Rest 的记录 ID 为 8351675，类别 HMSD（homestead），地名代表坐标为 -15.98111, 128.4178。气象站、牧场范围及植物来源标签可能采用不同参考位置，不能自动视为相同地点。

当前全量快照仅补充澳大利亚；其他国家继续使用在线搜索，并支持手动填写小地名和坐标。未覆盖的地方不能用附近城市或行政区中心冒充匹配结果。
