import { z } from "zod";

export const bookmarkSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().min(1).max(200),
});

export type BookmarkInput = z.infer<typeof bookmarkSchema>;
