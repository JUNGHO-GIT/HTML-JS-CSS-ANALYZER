// langs/css/CssRunner.ts

import { vscode } from "@exportLibs";
import type { CssSupportLikeType } from "@exportTypes";
import { withPerformanceMonitoring, logger } from "@exportScripts";
import { collectAllStyles } from "@langs/css/CssAnalyzer";

// -------------------------------------------------------------------------------------------------
// CSS는 외부 Linter 의존 없이 사용/미사용 진단을 중심으로 동작하므로,
// Runner 는 현재 문서 기준으로 selector 수집과 간단한 일관성 체크만 수행한다.
export const runCssAnalyzer = async (doc: vscode.TextDocument, support: CssSupportLikeType): Promise<vscode.Diagnostic[]> => {
  return await withPerformanceMonitoring(`CSS analyzer: ${doc.fileName}`, async () => {
    try {
      // 현재 구조에서는 validate.ts 가 전체 교차언어 진단을 담당하므로,
      // 여기서는 selector 수집의 유효성 확인 정도에 그친다.
      await collectAllStyles(doc, support);
      return [];
    }
    catch (e: any) {
      logger(`error`, `CssRunner`, `CSS analyze error: ${e?.message || e}`);
      return [];
    }
  });
};
