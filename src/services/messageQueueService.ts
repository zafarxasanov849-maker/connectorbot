import { InlineKeyboard, Keyboard } from "grammy";
import { Queue } from "bullmq";
import { buildMessageQueue } from "../queue/messageQueue";
import { MessageJobData } from "../types/message";

function serializeMarkup(markup?: InlineKeyboard | Keyboard | any): any {
  if (!markup) return undefined;
  if (typeof markup === "object" && "toJSON" in markup && typeof markup.toJSON === "function") {
    return markup.toJSON();
  }
  return markup;
}

export function getMessageQueue(): Queue<MessageJobData> {
  return buildMessageQueue();
}

export async function enqueueTextMessage(params: {
  chatId: number;
  text: string;
  parseMode?: "Markdown" | "HTML" | "MarkdownV2";
  replyMarkup?: InlineKeyboard | Keyboard | any;
}): Promise<void> {
  const queue = getMessageQueue();
  await queue.add(
    "text",
    {
      kind: "text",
      chatId: params.chatId,
      text: params.text,
      parseMode: params.parseMode,
      replyMarkup: serializeMarkup(params.replyMarkup),
    },
    { removeOnComplete: true, attempts: 3, backoff: { type: "exponential", delay: 1000 } }
  );
}

export async function enqueueDocumentMessage(params: {
  chatId: number;
  filename: string;
  data: Buffer;
  caption?: string;
  replyMarkup?: InlineKeyboard | Keyboard | any;
}): Promise<void> {
  const queue = getMessageQueue();
  await queue.add(
    "document",
    {
      kind: "document",
      chatId: params.chatId,
      filename: params.filename,
      data: params.data.toString("base64"),
      caption: params.caption,
      replyMarkup: serializeMarkup(params.replyMarkup),
    },
    { removeOnComplete: true, attempts: 3, backoff: { type: "exponential", delay: 1000 } }
  );
}
