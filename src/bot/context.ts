import { Context, SessionFlavor } from "grammy";
import { IContentButton, IMediaFile, MediaType } from "../models/ContentPackage";

interface PendingMediaDraft {
  text?: string;
  buttons: IContentButton[];
  expectedMediaType: MediaType;
}

interface PendingSequenceDraft extends PendingMediaDraft {
  delay_minutes: number;
}

export interface BroadcastFlowState {
  stage: "target" | "content" | "confirm";
  target?: { type: "all" } | { type: "source"; source_tag: string };
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
  page?: number;
  pendingMedia?: PendingMediaDraft;
}

export interface SetContentFlowState {
  stage: "source" | "content" | "confirm";
  sourceTag?: string;
  messages?: {
    delay_minutes: number;
    text_message?: string;
    media_files: IMediaFile[];
    buttons: IContentButton[];
    order?: number;
  }[];
  pendingMessage?: PendingSequenceDraft;
}

export interface SessionData {
  broadcastFlow?: BroadcastFlowState;
  setContentFlow?: SetContentFlowState;
  manageFlow?: {
    sourceTag?: string;
    mode?: "edit" | "delete" | "delete_tag_confirm";
    messageIndex?: number;
    pendingMessage?: PendingSequenceDraft;
  };
}

export type BotContext = Context & SessionFlavor<SessionData>;
