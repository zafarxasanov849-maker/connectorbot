import { extractMedia, parseMessageText } from "./messageParser";
import { ISequenceMessage, MediaType } from "../models/ContentPackage";
import { Message } from "grammy/types";

export function parseSequenceMessage(
  message?: Message
): {
  sequence?: ISequenceMessage;
  error?: string;
  awaitingMediaType?: MediaType;
} {
  if (!message) return { error: "No message provided." };
  const rawText = message && "text" in message ? message.text : message?.caption;
  if (!rawText) return { error: "Text with interval is required." };

  const lines = rawText.split("\n").map((l) => l.trim());
  const firstNonEmptyIndex = lines.findIndex((l) => l.length > 0);
  const firstLine = firstNonEmptyIndex >= 0 ? lines[firstNonEmptyIndex] : undefined;
  const delay = firstLine ? Number(firstLine) : NaN;
  if (!Number.isFinite(delay) || delay < 0) {
    return { error: "First line must be a non-negative number (minutes)." };
  }

  const remainingText = lines.slice(firstNonEmptyIndex + 1).join("\n");
  const { cleanedText, buttons, requestedMediaType } =
    parseMessageText(remainingText);
  const media = extractMedia(message);

  if (
    requestedMediaType &&
    media.length &&
    media[0].type &&
    media[0].type !== requestedMediaType
  ) {
    return {
      error: `Expected ${requestedMediaType} media, but received ${media[0].type}.`,
    };
  }

  if (!cleanedText && !media.length && !requestedMediaType) {
    return { error: "Provide text or media after the delay line." };
  }

  const sequence: ISequenceMessage = {
    delay_minutes: delay,
    text_message: cleanedText,
    media_files: media,
    buttons,
    order: undefined,
  };

  return { sequence, awaitingMediaType: requestedMediaType };
}
