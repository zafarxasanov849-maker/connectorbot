export type MessageJobData =
  | {
      kind: "text";
      chatId: number;
      text: string;
      parseMode?: "Markdown" | "HTML" | "MarkdownV2";
      replyMarkup?: any;
    }
  | {
      kind: "document";
      chatId: number;
      filename: string;
      data: string; // base64
      caption?: string;
      replyMarkup?: any;
    };
