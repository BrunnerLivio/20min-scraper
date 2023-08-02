import { db } from "./db.js";

export async function seed() {
  await db.run(
    "CREATE TABLE IF NOT EXISTS articles (title TEXT, link TEXT, pubDate TEXT, content TEXT, contentSnippet TEXT, guid TEXT, isoDate TEXT)"
  );

  await db.run(
    "CREATE TABLE IF NOT EXISTS comments (" +
      "author TEXT, " +
      "createdAt TEXT, " +
      "content TEXT, " +
      "reactions_quatsch INTEGER, " +
      "reactions_unnoetig INTEGER, " +
      "reactions_genau INTEGER, " +
      "reactions_love_it INTEGER, " +
      "reactions_smart INTEGER, " +
      "reactions_so_nicht INTEGER, " +
      "articleId INTEGER, " +
      "parentId INTEGER, " +
      "FOREIGN KEY(articleId) REFERENCES articles(rowid), " +
      "FOREIGN KEY(parentId) REFERENCES comments(rowid)" +
      ")"
  );
}