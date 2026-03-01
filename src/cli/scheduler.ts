import { executeCli } from "./shared.ts";

async function execute(): Promise<void> {
  try {
    const result = await executeCli();
    console.log(result.summaryText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  }
}

await execute();
setInterval(() => {
  void execute();
}, 60 * 60 * 1000);
