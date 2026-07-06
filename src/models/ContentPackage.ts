import { Schema, model, Document } from "mongoose";

export interface IContentButton {
  label: string;
  url: string;
}

export type MediaType =
  | "photo"
  | "video"
  | "video_note"
  | "document"
  | "voice"
  | "audio"
  | "animation";

export interface IMediaFile {
  file_id: string;
  type?: MediaType;
}

export interface ISequenceMessage {
  text_message?: string;
  media_files: IMediaFile[];
  buttons: IContentButton[];
  delay_minutes: number;
  order?: number;
}

export interface IContentPackage extends Document {
  source_tag: string;
  messages: ISequenceMessage[];
  created_at: Date;
}

const ButtonSchema = new Schema<IContentButton>(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const MediaSchema = new Schema<IMediaFile>(
  {
    file_id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "photo",
        "video",
        "video_note",
        "document",
        "voice",
        "audio",
        "animation",
      ],
      default: "document",
    },
  },
  { _id: false }
);

const ContentPackageSchema = new Schema<IContentPackage>({
  source_tag: { type: String, unique: true, required: true },
  messages: {
    type: [
      new Schema<ISequenceMessage>(
        {
          text_message: { type: String },
          media_files: { type: [MediaSchema], default: [] },
          buttons: { type: [ButtonSchema], default: [] },
          delay_minutes: { type: Number, required: true },
          order: { type: Number },
        },
        { _id: false }
      ),
    ],
    default: [],
  },
  created_at: { type: Date, default: Date.now },
});

export const ContentPackageModel = model<IContentPackage>(
  "ContentPackage",
  ContentPackageSchema
);
