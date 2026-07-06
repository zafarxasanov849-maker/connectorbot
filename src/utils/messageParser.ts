import { Message } from "grammy/types";
import {
  IMediaFile,
  IContentButton,
  MediaType,
} from "../models/ContentPackage";

const buttonRegex = /^(.+?)\s*-\s*(https?:\/\/\S+)/i;
const mediaDirectiveRegex =
  /^MEDIA:\s*(photo|video|video_note|document|voice|audio|animation)\s*$/i;

export function extractMedia(message?: Message): IMediaFile[] {
  if (!message) return [];
  if ("photo" in message && message.photo?.length) {
    const file = message.photo[message.photo.length - 1];
    return [{ file_id: file.file_id, type: "photo" }];
  }
  if ("video" in message && message.video) {
    return [{ file_id: message.video.file_id, type: "video" }];
  }
  if ("video_note" in message && message.video_note) {
    return [{ file_id: message.video_note.file_id, type: "video_note" }];
  }
  if ("document" in message && message.document) {
    return [{ file_id: message.document.file_id, type: "document" }];
  }
  if ("voice" in message && message.voice) {
    return [{ file_id: message.voice.file_id, type: "voice" }];
  }
  if ("audio" in message && message.audio) {
    return [{ file_id: message.audio.file_id, type: "audio" }];
  }
  if ("animation" in message && message.animation) {
    return [{ file_id: message.animation.file_id, type: "animation" }];
  }
  return [];
}

export function parseMessageText(text?: string): {
  cleanedText?: string;
  buttons: IContentButton[];
  requestedMediaType?: MediaType;
} {
  if (!text) return { cleanedText: text, buttons: [] };

  const lines = text.split("\n");
  const buttons: IContentButton[] = [];
  const contentLines: string[] = [];
  let requestedMediaType: MediaType | undefined;

  for (const line of lines) {
    const mediaMatch = line.match(mediaDirectiveRegex);
    if (mediaMatch) {
      requestedMediaType = mediaMatch[1].toLowerCase() as MediaType;
      continue;
    }

    const buttonMatch = line.match(buttonRegex);
    if (buttonMatch) {
      buttons.push({
        label: buttonMatch[1].trim(),
        url: buttonMatch[2].trim(),
      });
      continue;
    }

    contentLines.push(line);
  }

  return {
    cleanedText: contentLines.join("\n").trim(),
    buttons,
    requestedMediaType,
  };
}

export function parseButtonsFromText(
  text?: string
): { cleanedText?: string; buttons: IContentButton[] } {
  const { cleanedText, buttons } = parseMessageText(text);
  return { cleanedText, buttons };
}
