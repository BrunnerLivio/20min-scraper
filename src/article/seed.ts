import { db } from "../db/db.js";

async function seed() {
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

  // Create author column if not exists
  const authorColumn = await db.get(
    "SELECT sql FROM sqlite_master WHERE name = 'articles' AND sql LIKE '%author%'"
  );
  if (!authorColumn) {
    await db.run("ALTER TABLE articles ADD COLUMN author TEXT");
  }
}

export default seed;
