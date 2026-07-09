import {
  ContentPackageModel,
  IContentPackage,
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
  messages?: ISequenceMessage[];
}): Promise<IContentPackage> {
  return ContentPackageModel.findOneAndUpdate(
    { source_tag: params.sourceTag },
    { messages: normalizeSequenceMessages(params.messages ?? []) },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function deleteContentPackage(
  sourceTag: string
): Promise<IContentPackage | null> {
  return ContentPackageModel.findOneAndDelete({ source_tag: sourceTag }).lean();
}

// Mavjud tag kontentini yangi tagga nusxalaydi. Faqat xabarlar ko'chiriladi;
// yangi tag o'zining toza, alohida analitikasi bilan boshlanadi.
export async function cloneContentPackage(
  fromTag: string,
  toTag: string
): Promise<{ ok: boolean; reason?: "not_found" | "exists"; count?: number }> {
  const src = await ContentPackageModel.findOne({ source_tag: fromTag }).lean();
  if (!src) return { ok: false, reason: "not_found" };

  const existing = await ContentPackageModel.findOne({ source_tag: toTag }).lean();
  if (existing) return { ok: false, reason: "exists" };

  const messages = normalizeSequenceMessages(
    (src.messages ?? []).map((m) => ({
      delay_minutes: m.delay_minutes,
      text_message: m.text_message,
      media_files: m.media_files ?? [],
      buttons: m.buttons ?? [],
    }))
  );

  await ContentPackageModel.create({ source_tag: toTag, messages });
  return { ok: true, count: messages.length };
}
