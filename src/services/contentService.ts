import {
  ContentPackageModel,
  IContentPackage,
  IMediaFile,
  IContentButton,
  ISequenceMessage,
} from "../models/ContentPackage";

function normalizeSequenceMessages(
  messages: ISequenceMessage[] = []
): ISequenceMessage[] {
  return messages.map((message, index) => ({
    ...message,
    order: index,
  }));
}

export async function getContentBySourceTag(
  sourceTag?: string
): Promise<IContentPackage | null> {
  if (!sourceTag) return null;
  return ContentPackageModel.findOne({ source_tag: sourceTag }).lean();
}

export async function listContentTags(): Promise<string[]> {
  const docs = await ContentPackageModel.find({}, { source_tag: 1 }).lean();
  return docs.map((d) => d.source_tag).filter(Boolean);
}

export async function getPackageWithMessages(
  sourceTag: string
): Promise<IContentPackage | null> {
  return ContentPackageModel.findOne({ source_tag: sourceTag }).lean();
}

export async function updateSequenceMessages(params: {
  sourceTag: string;
  messages: ISequenceMessage[];
}): Promise<IContentPackage | null> {
  return ContentPackageModel.findOneAndUpdate(
    { source_tag: params.sourceTag },
    { messages: normalizeSequenceMessages(params.messages) },
    { new: true }
  );
}

export async function setContentPackage(params: {
  sourceTag: string;
  text?: string;
  media?: IMediaFile[];
  buttons?: IContentButton[];
  messages?: ISequenceMessage[];
}): Promise<IContentPackage> {
  const update = {
    text_message: params.text,
    media_files: params.media ?? [],
    buttons: params.buttons ?? [],
    messages: normalizeSequenceMessages(params.messages ?? []),
  };

  return ContentPackageModel.findOneAndUpdate(
    { source_tag: params.sourceTag },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function deleteContentPackage(
  sourceTag: string
): Promise<IContentPackage | null> {
  return ContentPackageModel.findOneAndDelete({ source_tag: sourceTag }).lean();
}
