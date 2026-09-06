import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { AppBootstrap } from "./app/AppBootstrap";
import { createCrownlineDetailLoader } from "./data/loadCrownlineDetail";
import { createCrownlineBoundariesLoader } from "./data/loadCrownlineBoundaries";
import { loadGeneratedGeography } from "./data/loadCrownlineGeography";
import { loadCrownlineIndex } from "./data/loadCrownlineIndex";
import "./styles/styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("缺少应用根节点 #root");
}

const root = createRoot(rootElement);
root.render(
  <AppBootstrap
    loadIndex={loadCrownlineIndex}
    renderApp={(data) => (
      <StrictMode>
        <App
          data={data}
          loadDetail={createCrownlineDetailLoader(data)}
          loadGeography={() => loadGeneratedGeography()}
          loadBoundaries={createCrownlineBoundariesLoader()}
        />
      </StrictMode>
    )}
  />
);
