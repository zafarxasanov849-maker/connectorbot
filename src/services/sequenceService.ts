import { Queue } from "bullmq";
import { ISequenceMessage } from "../models/ContentPackage";
import { SequenceJobData } from "../types/sequence";
import { buildSequenceQueue } from "../queue/sequenceQueue";

export async function scheduleSequenceMessages(params: {
  chatId: number;
  messages: ISequenceMessage[];
  joinedAt?: Date;
}): Promise<void> {
  if (!params.messages.length) return;
  const queue = getSequenceQueue();
  const joined = params.joinedAt ?? new Date();
  const now = Date.now();

  const jobs = params.messages.map((msg, index) => {
    const delayMs = Math.max(0, (msg.delay_minutes ?? 0) * 60 * 1000);
    const when = joined.getTime() + delayMs;
    const delay = Math.max(0, when - now);
    const jobData: SequenceJobData = {
      chatId: params.chatId,
      text: msg.text_message,
      media: msg.media_files,
      buttons: msg.buttons,
    };
    return queue.add("sequence-message", jobData, {
      delay,
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      jobId: `seq:${params.chatId}:${when}:${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    });
  });

  await Promise.all(jobs);
}

export function getSequenceQueue(): Queue<SequenceJobData> {
  return buildSequenceQueue();
}
