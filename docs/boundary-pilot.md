# Crownline 疆域快照 MVP 试点记录

本试点只建立可按年份浏览的低分辨率空间示意，不建立完整历史 GIS。所有记录都使用 `MultiPolygon`、WGS 84 经度/纬度顺序 `[longitude, latitude]`，并在生成前经过闭合、非零面积、连续重复坐标、反经线和时间语义校验。

## 资料与许可审查

候选资料先核查是否允许坐标再分发和派生。OpenHistoricalMap 的版权说明称，除单独标注的条目外，其数据以 CC0 方式提供；其 Overpass 文档也说明可按带日期的 boundary relation 查询和导出。该平台同时提醒使用者检查个别元素的 license 标签，因此本批次只采用平台版权说明和数据记录均能支持的候选，并保留保守的 `schematic` / `approximate` 精度，不把结果写成精确边界。

审查入口：

- [OpenHistoricalMap copyright](https://www.openhistoricalmap.org/copyright)
- [OpenHistoricalMap reuse / REST API](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Reuse)
- [OpenHistoricalMap Overpass](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Overpass)
- [OpenHistoricalMap boundaries](https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Boundaries)
- [The Metropolitan Museum of Art: Byzantium](https://www.metmuseum.org/essays/byzantium-ca-330-1453)
- [The Metropolitan Museum of Art: Abbasid period](https://www.metmuseum.org/essays/the-art-of-the-abbasid-period-750-1258)
- [British Museum: Ottoman dynasty](https://www.britishmuseum.org/collection/term/x14382)
- [中国历史纪年简表](https://scopsr.gov.cn/zlzx/lsgk/201811/t20181120_326615.html)

| 政权 | 候选快照年代 | 资料来源 | 许可 | 是否采用 | 原因 |
| --- | --- | --- | --- | --- | --- |
| 唐 | 650—690；705—755 | OpenHistoricalMap dated boundary relations；中国历史纪年简表核对时期 | CC0 1.0（OHM 数据口径） | 是 | 已有政权与点位数据；覆盖中国历史地区；只保留低分辨率核心示意 |
| 拜占庭帝国 | 800—1025；1261—1453 | OpenHistoricalMap Byzantine / Eastern Roman relations；Met Byzantium | CC0 1.0（OHM 数据口径） | 是 | 已有真实政权；覆盖欧洲与西亚；分期变化明确，但边缘控制仍有争议 |
| 阿拔斯哈里发 | 750—861；1050—1190 | OpenHistoricalMap Abbasid relations；Met Abbasid period | CC0 1.0（OHM 数据口径） | 是 | 已有真实政权；早期扩张与后期核心范围可作为对比，可信度降为 low |
| 奥斯曼帝国 | 1453—1683；1829—1913 | OpenHistoricalMap Ottoman relations；British Museum Ottoman dynasty | CC0 1.0（OHM 数据口径） | 是 | 已有真实政权；扩张高峰与十九世纪收缩可形成时间点对比 |
| 历史底图仓库（通用候选） | 多个年份 | aourednik/historical-basemaps | GPL-3.0 与数据许可边界仍有公开疑问 | 否 | 仓库 README 表示需核验，且数据许可是否独立于软件许可存在争议；不进入生产坐标 |
| 商业历史地图或未注明许可图片 | 静态概览图 | 未核明 | 不明 | 否 | 不满足可再分发派生坐标要求；不描摹、不转换进生产数据 |

## 处理流程

生产源文件位于 `src/data/source/boundaries/`，按政权分片维护；生成器只读取已提交的 JSON，不在构建期联网。每条记录的 `provenance` 固定登记：资料集名称、署名、许可地址、来源地址、派生关系、坐标系、控制点数量变化、简化方法和人工检查口径。

本批次的离线处理约定如下：

1. 从带 `start_date` / `end_date` 的公开 boundary relation 中筛选与 Crownline 采用年份相符的候选。
2. 按 WGS 84 / EPSG:4326 读取坐标；统一为 GeoJSON `[longitude, latitude]`，不跨反经线。
3. 对候选轮廓进行固定控制点保留的保守简化；不在浏览器执行简化，不使用现代行政边界替代历史疆域。
4. 保留离散 polygon，必要时保留洞环结构；不修复错误坐标，不用构建脚本静默改形。
5. 运行 `npm run validate:data` 和 `npm run check:boundaries`，再人工检查浅色/深色与多政权叠加显示。

当前预算：原始 `boundaries.json` 不超过 500 KB，gzip 不超过 150 KB，总坐标位置不超过 1,200，单条快照不超过 180 个位置，试点快照不超过 10 条。当前实际为 8 条、71 个坐标位置，单条最多 12 个位置；原始与 gzip 大小由 `npm run check:boundaries` 重新计算，不手填到文档。

## 历史解释限制

这些多边形是根据公开资料重建或简化的历史空间示意，只适用于各自的时间范围，不代表整个政权存续期、范围内每个地点的同等控制、现代主权或精确面积/距离。边缘地区可能涉及羁縻、附庸、间接统治、海上控制和资料争议。两个图形视觉上相交时，Crownline 仍只显示两个独立快照，不自动生成接壤、空间重叠、战争、外交、臣属或领土得失结论。

本 MVP 不支持连续年份插值、竞争性重建版本、自动空间关系、面积排序或反经线几何。扩展试点前必须先完成逐政权、逐时期、逐来源的许可和历史口径复核。
