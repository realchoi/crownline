import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { loadCrownlineData } from "./data/loadCrownlineData";
import "./styles/styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("缺少应用根节点 #root");
}

const root = createRoot(rootElement);
try {
  // 数据在首次渲染前完成校验，避免坏数据进入组件树后产生部分页面。
  root.render(
    <StrictMode>
      <App data={loadCrownlineData()} />
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
