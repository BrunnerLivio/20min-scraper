import { Author } from "../author/author.js";
import { db } from "../db/db.js";
import { createLogTimer, log } from "../utils/logger.js";
import { Article } from "./article.js";

async function seed() {
  const logger = createLogTimer("SEED");
  await db.run(
    "CREATE TABLE IF NOT EXISTS articles (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "title TEXT, " +
      "link TEXT, " +
      "pubDate TEXT, " +
      "content TEXT, " +
      "contentSnippet TEXT, " +
      "author TEXT, " +
      "guid TEXT, " +
      "category TEXT, " +
      "isoDate TEXT" +
      ")"
  );

  // Migrations:
  // Create author table if not exists
  await db.run(
    "CREATE TABLE IF NOT EXISTS authors (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "name TEXT" +
      ")"
  );

  // Create article_author table if not exists
  await db.run(
    "CREATE TABLE IF NOT EXISTS article_author (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "articleId INTEGER, " +
      "authorId INTEGER" +
      ")"
  );

  // The legacy "author" column has the authors split by comma
  // We need to migrate them to the new tables
  const articleColumn = await db.get(
    "SELECT sql FROM sqlite_master WHERE name = 'article' AND sql LIKE '%author%'"
  );

  if (!articleColumn) {
    const articles = await db.all<Article & { author: string }>(
      "SELECT * FROM articles"
    );

    for (const article of articles) {
      if (article.author) {
        log(`Migrating authors for article ${article.id}`);
        const authors = article.author
          .split(",")
          .map((author) => author.trim());

        for (const author of authors) {
          const authorExists = await db.get(
            "SELECT * FROM authors WHERE name = ?",
            [author]
          );

          if (!authorExists) {
            await db.run("INSERT INTO authors (name) VALUES (?)", [author]);
          }

          const authorId = await db.get<Author>(
            "SELECT id FROM authors WHERE name = ?",
            [author]
          );

          await db.run(
            "INSERT INTO article_author (articleId, authorId) VALUES (?, ?)",
            [article.id, authorId.id]
          );
        }
      }
    }

    // Drop the legacy author column
    await db.run("ALTER TABLE articles RENAME TO _articles");
    await db.run(
      "CREATE TABLE articles (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "title TEXT, " +
        "link TEXT, " +
        "pubDate TEXT, " +
        "content TEXT, " +
        "contentSnippet TEXT, " +
        "guid TEXT, " +
        "category TEXT, " +
        "isoDate TEXT" +
        ")"
    );

    await db.run(
      "INSERT INTO articles (title, link, pubDate, content, contentSnippet, guid, category, isoDate) " +
        "SELECT title, link, pubDate, content, contentSnippet, guid, category, isoDate FROM _articles"
    );

    await db.run("DROP TABLE _articles");
  }

  logger.end();
}

export default seed;
