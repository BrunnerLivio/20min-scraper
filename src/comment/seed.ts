import { db } from "../db/db.js";

async function seed() {
  await db.run(
    "CREATE TABLE IF NOT EXISTS comments (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
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
      "FOREIGN KEY(articleId) REFERENCES articles(id), " +
      "FOREIGN KEY(parentId) REFERENCES comments(id)" +
      ")"
  );
}

export default seed;
