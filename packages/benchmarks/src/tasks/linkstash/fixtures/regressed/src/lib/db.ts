export type BookmarkRecord = {
  id: string;
  userId: string;
  url: string;
  title: string;
  createdAt: string;
};

const bookmarks = new Map<string, BookmarkRecord>();

export const db = {
  async listBookmarks(userId: string): Promise<BookmarkRecord[]> {
    return [...bookmarks.values()].filter((bookmark) => bookmark.userId === userId);
  },
  async createBookmark(
    userId: string,
    input: { url: string; title: string },
  ): Promise<BookmarkRecord> {
    const record: BookmarkRecord = {
      id: `bookmark-${bookmarks.size + 1}`,
      userId,
      url: input.url,
      title: input.title,
      createdAt: new Date().toISOString(),
    };

    bookmarks.set(record.id, record);
    return record;
  },
};
