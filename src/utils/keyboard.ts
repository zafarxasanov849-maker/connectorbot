import { InlineKeyboard } from "grammy";
import { IContentButton } from "../models/ContentPackage";

export function buildInlineKeyboard(buttons: IContentButton[]): InlineKeyboard | undefined {
  if (!buttons?.length) return undefined;
  const keyboard = new InlineKeyboard();
  buttons.forEach((btn) => {
    keyboard.url(btn.label, btn.url);
    keyboard.row();
  });
  return keyboard;
}
