import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { createCrownlineDetailLoader } from "./data/loadCrownlineDetail";
import { loadCrownlineIndex } from "./data/loadCrownlineIndex";
import "./styles/styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("缺少应用根节点 #root");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <main className="site-shell data-loading" role="status">
      <p>正在加载历史数据…</p>
    </main>
  </StrictMode>
);
try {
  const data = await loadCrownlineIndex();
  root.render(
    <StrictMode>
      <App data={data} loadDetail={createCrownlineDetailLoader(data)} />
    </StrictMode>
  );
} catch (error) {
  // 启动失败时保留可读提示，并将详细错误输出到开发者控制台。
  console.error(error);
  root.render(
    <main className="site-shell data-error" role="alert">
      <h1>历史数据校验失败</h1>
      <p>请运行 npm run validate:data 查看具体错误后再重新构建。</p>
    </main>
  );
}
