import { executeCli } from "./shared.ts";

const result = await executeCli({ dryRun: true });
console.log(result.summaryText);
