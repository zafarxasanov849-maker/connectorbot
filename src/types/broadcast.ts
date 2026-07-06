import { IContentButton, IMediaFile } from "../models/ContentPackage";

export interface BroadcastJobData {
  chatIds: number[];
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
}
