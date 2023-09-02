import { db } from "../db/db.js";
import { RSSFeedArticle } from "../RSSFeed.js";
import { Article } from "./article.js";

let UPDATED_ARTICLES = 0;
let CREATED_ARTICLES = 0;

async function articleExists(guid: string) {
  const row = await db.get("SELECT rowid AS id FROM articles WHERE guid = ?", [
    guid,
  ]);

  return !!row;
}

/////////////////////////////////////////////////////////////////////////////////////

export async function insertArticle(item: RSSFeedArticle) {
  const exists = await articleExists(item.guid);
  if (!exists) {
    await db.run(
      "INSERT INTO articles (title, link, pubDate, content, contentSnippet, guid, isoDate) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        item.title,
        item.link,
        item.pubDate,
        item.content,
        item.contentSnippet,
        item.guid,
        item.isoDate,
      ]
    );
    CREATED_ARTICLES++;
  }
}

export async function updateContentArticle(item: RSSFeedArticle) {
  const exists = await articleExists(item.guid);
  if (exists) {
    await db.run("UPDATE articles SET content = ?, WHERE guid = ?", [
      item.content,
      item.guid,
    ]);
  }
}

/////////////////////////////////////////////////////////////////////////////////////

export async function getRecentArticles() {
  return await db.all<Article>(
    "SELECT rowid AS id, * FROM articles WHERE pubDate > datetime('now', '-3 days')"
  );
}

export const getUpdatedArticles = () => UPDATED_ARTICLES;
export const getCreatedArticles = () => CREATED_ARTICLES;
