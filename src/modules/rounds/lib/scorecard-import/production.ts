import { parseRoundScorecardImage } from "./parser";
import { createRoundScorecardImport } from "./workflow";

export const roundScorecardImports = createRoundScorecardImport({
  parseImage: parseRoundScorecardImage,
});
