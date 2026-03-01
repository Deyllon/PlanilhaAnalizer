import assert from "node:assert/strict";
import test from "node:test";
import { formatPreviewMessages, generatePreviewMessages } from "../../src/preview/message-preview.ts";

test("generatePreviewMessages returns sample 08h, 12h and 19h messages", async () => {
  const preview = await generatePreviewMessages();

  assert.match(preview.morning, /Relatório 08h/u);
  assert.match(preview.morning, /Não agendados/u);

  assert.match(preview.midday, /Relatório 12h/u);
  assert.match(preview.midday, /Mudanças de status/u);

  assert.match(preview.nightly, /Resumo 19h/u);
  assert.match(preview.nightly, /Aprovados e ainda não agendados/u);

  const formatted = formatPreviewMessages(preview);
  assert.match(formatted, /=== 08h ===/u);
  assert.match(formatted, /=== 12h ===/u);
  assert.match(formatted, /=== 19h ===/u);
});
