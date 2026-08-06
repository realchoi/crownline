import { loadCrownlineData } from "../src/data/loadCrownlineData";

// 独立命令行入口复用应用运行时校验，确保本地与构建环境采用同一套规则。
try {
  const data = loadCrownlineData();
  console.log(
    `数据校验通过：${data.timelineSections.length} 个阶段，${data.entities.length} 个实体`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
