import { formatPreviewMessages, generatePreviewMessages } from "../preview/message-preview.ts";

const preview = await generatePreviewMessages();
console.log(formatPreviewMessages(preview));
