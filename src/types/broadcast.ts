import { IContentButton, IMediaFile } from "../models/ContentPackage";

export interface BroadcastJobData {
  chatId: number;
  broadcastId?: string;
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
}
