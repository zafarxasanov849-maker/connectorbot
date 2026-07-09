import { IContentButton, IMediaFile } from "../models/ContentPackage";

export interface BroadcastJobData {
  chatId: number;
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
}
