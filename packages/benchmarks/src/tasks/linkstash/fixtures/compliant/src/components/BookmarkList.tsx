"use client";

import { useEffect, useState } from "react";

type Bookmark = {
  id: string;
  url: string;
  title: string;
};

export function BookmarkList() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    let active = true;

    void fetch("/api/bookmarks")
      .then((response) => response.json())
      .then((data: { bookmarks?: Bookmark[] }) => {
        if (active) {
          setBookmarks(data.bookmarks ?? []);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (bookmarks.length === 0) {
    return <p>No bookmarks yet.</p>;
  }

  return (
    <ul>
      {bookmarks.map((bookmark) => (
        <li key={bookmark.id}>
          <a href={bookmark.url}>{bookmark.title}</a>
        </li>
      ))}
    </ul>
  );
}
