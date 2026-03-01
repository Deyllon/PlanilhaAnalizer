const scope = process.argv[2] ?? "all";

if (scope === "all" || scope === "unit") {
  await import("./unit/datetime.test.ts");
  await import("./unit/rules.test.ts");
  await import("./unit/shared.test.ts");
  await import("./unit/summary.test.ts");
  await import("./unit/message-preview.test.ts");
  await import("./unit/twilio-client.test.ts");
}

if (scope === "all" || scope === "integration") {
  await import("./integration/reader.test.ts");
  await import("./integration/run-job.test.ts");
  await import("./integration/twilio-client.test.ts");
}
