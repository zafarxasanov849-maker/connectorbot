import { IContentButton, IMediaFile } from "../models/ContentPackage";

export interface SequenceJobData {
  chatId: number;
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
}
