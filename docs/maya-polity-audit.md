# 古典期玛雅主体审查

审查日期：2026-09-08。

## 结论

原 polity-maya-city-states 把多个独立城邦建模成一个政权，又把帕伦克、卡拉克穆尔、蒂卡尔和科潘君主放进同一王统，违反“人物与任期必须归属于真实政治主体”的数据语义。该 ID 现保留为 historical-period，名称改为“古典期玛雅诸城邦”，使旧详情链接仍能打开并解释约250—900年的浏览分期；历史分期不再承载任期、点位、关系或事件，也会被现有 URL 清洗逻辑排除出对比对象。

人物与任期按证据拆为四个政权：

| 政权 | 当前校订存续口径 | 已迁入人物 |
| --- | --- | --- |
| 蒂卡尔 | 约90—约900；王表奠基者至遗址末期活动的宽口径 | 贾萨·钱·卡维一世（682—734） |
| 帕伦克 | 431—约900；首位王统即位至约9世纪弃置 | 帕卡尔大帝（615—683） |
| 卡拉克穆尔 | 562—约909；明确首都节点至最后有日期石碑 | 尤克诺姆大帝（636—686） |
| 科潘 | 427—约900；王统建立至遗址约10世纪初弃置 | 卡克·钱·约帕特（578—628）、瓦沙克卢洪·乌巴·卡维（695—738） |

这些终点是带说明的争议口径。遗址占用、最后石碑与同一中央政权持续存在不是同一事实，因此没有把四个城邦都机械复制成250—900年的确定政权。

## 人物纠错

原 person-maya-k-ahk 的578—628年任期对应科潘第11位君主，但姓名和别名写成了基里瓜统治者 K’ak’ Tiliw Chan Yopaat（Cauac Sky）。哈佛大学皮博迪博物馆的祭坛 Q 资料把科潘第11位君主记作 Buts’ Chan，并给出578年11月19日即位；第12位君主于628年2月8日即位。Cauac Sky 则是738年击败科潘第13位君主的基里瓜统治者。人物现更正为卡克·钱·约帕特 / K’ak’ Chan Yopaat / Butz’ Chan，保留人物与任期 ID 以避免无必要的引用断裂。

## 关系、事件与点位

378年“进入”事件直接发生在蒂卡尔，因此 event-teotihuacan-tikal-entrada-378 和对应战争关系的玛雅参与方改为蒂卡尔。现有文化交流关系引用的论文也具体研究蒂卡尔遗址，所以同样收窄到蒂卡尔，没有外推到全部玛雅政治体。

原来唯一的 Tikal 点位已迁给蒂卡尔。帕伦克、卡拉克穆尔和科潘根据各自 UNESCO 世界遗产档案补入政治中心点位。四条记录都把档案坐标换算为十进制度，并统一使用 regional 精度；其中卡拉克穆尔明确标注为扩展世界遗产地的区域锚点，不冒充古城核心测点。点位适用期受各政权上述校订区间约束。

## 直接依据

- [OpenStax §8.2](https://openstax.org/books/world-history-volume-1/pages/8-2-early-cultures-and-civilizations-in-the-americas)：古典期约250—900年，约四十个玛雅城邦并存，并列举 Tikal、Calakmul、Palenque 与 Copan。
- [UNESCO Tikal](https://whc.unesco.org/en/list/64/)：蒂卡尔是政治、经济与军事中心；铭文记录王统及跨城关系；Dossier 64 坐标为 N17 13 0 W89 37 0。
- [Mesoweb Tikal rulers](https://www.mesoweb.com/es/gobernantes/tikal/gobernantes.html)：王统奠基者约90年；贾萨·钱·卡维一世682年即位，其继承者734年即位。
- [UNESCO Palenque](https://whc.unesco.org/en/list/411/)：约500年成为区域政治单位的强势首都，约9世纪弃置；Dossier 411 坐标为 N17 28 59.988 W92 2 60。
- [Mesoweb Palenque rulers](https://www.mesoweb.com/palenque/resources/rulers/rulers_table.html)：K’uk’ B’ahlam 一世431年即位；帕卡尔615年即位、683年去世。
- [INAH Calakmul](https://lugares.inah.gob.mx/es/node/4376)：562年成为蛇首王国首都，尤克诺姆大帝636—686年，最后有日期石碑为909年。
- [UNESCO Calakmul](https://whc.unesco.org/en/list/1061/)：铭文保存区域政治史；Dossier 1061bis 坐标为 N18 3 10.9 W89 44 14.22。
- [UNESCO Copan](https://whc.unesco.org/en/list/129/)：Yax Kuk Mo 于427年开启十六位统治者王统；Dossier 129bis 坐标为 N14 50 16.8 W89 8 31.2。
- [Harvard Peabody, Altar Q and Copán](https://peabody.harvard.edu/altar-q-and-cop%C3%A1n)：科潘第11至13位君主的身份、即位与覆亡日期。

完整来源对象及逐条 locator 位于 src/data/source/sources/maya-city-states.json，基线100条缺 locator 点位的审查状态位于 src/data/source/reviews/geography-locator-evidence-review.json。
