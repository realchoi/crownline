# 批次审查归档

本目录保存已经完成的来源定位与地图点位批次审查记录。它们记录当时的取舍、来源与修改前后区间，供历史追溯使用；文中的计数只反映各批次完成时的数据快照。当前规则以[数据契约](../data-contract.md)为准，当前数量以各文档的 `crownline-data-stats` 区块和 `npm run check:evidence` 预算为准。

| 日期       | 记录                                                  | 内容                                              |
| ---------- | ----------------------------------------------------- | ------------------------------------------------- |
| 2026-09-07 | [按年份的资料覆盖与首批地理校订](temporal-coverage-review.md) | 覆盖报告 v3 与首批分期点位                        |
| 2026-09-08 | [第二批分期地图点位审查](temporal-geography-p1-review.md) | 前燕、南明、西秦与神圣罗马帝国                    |
| 2026-09-10 | [第二批地理点位证据审查](geography-evidence-p2.md)    | 16 条跨地区点位与隋、唐、元年份缺口               |
| 2026-09-15 | [第一批全记录来源定位](source-evidence-p0.md)         | 核心实体、拜占庭与高丽王表、跨地区点位            |
| 2026-09-15 | [第二批来源定位](source-evidence-p0-2.md)             | 八个点位闭环与建康坐标引用                        |
| 2026-09-16 | [第三批来源定位](source-evidence-p0-3.md)             | 洛阳、开封、成都与姑臧坐标对象                    |
| 2026-09-23 | [第四批来源定位](source-evidence-p0-4.md)             | 东吴武昌纠错与具名王表条目                        |
| 2026-09-23 | [萨迈拉分期点位审查](temporal-geography-p2-review.md) | 阿拔斯哈里发836—892年第二都城                     |

这些批次确立的规则已改写为不变量测试：`tests/source-evidence-rules.test.ts`、`tests/geography-evidence-rules.test.ts` 与 `tests/geography-chronology.test.ts`。
