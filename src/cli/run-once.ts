import { executeCli } from "./shared.ts";

const result = await executeCli();
console.log(result.summaryText);
