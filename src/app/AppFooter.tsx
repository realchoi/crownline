/** Project-wide chronology caveat and source links. */
export function AppFooter() {
  return (
    <footer className="footer-note">
      <p>
        <strong>纪年说明：</strong>
        夏、商早期年代使用常见估年；清朝可从 1636 年改国号或 1644
        年入关起算；南明等政权的终止年份亦有不同口径。页面中的说明用于通史浏览，不替代专业断代研究。
      </p>
      <p>
        <strong>资料参考：</strong>
        <a
          href="https://scopsr.gov.cn/zlzx/lsgk/201811/t20181120_326615.html"
          target="_blank"
          rel="noreferrer"
        >
          《中国历史纪年简表》
        </a>
        、
        <a href="https://www.chnmuseum.cn/" target="_blank" rel="noreferrer">
          中国国家博物馆
        </a>
        的中国古代史分期，以及通行历史年表。
      </p>
      <p>
        <strong>Crownline · 王冠纪</strong>——沿时间线探索世界王朝、帝国与文明的兴衰。
      </p>
    </footer>
  );
}
