import { db } from "../db/db.js";
import { Author } from "./author.js";

let CREATED_AUTHORS = 0;
let UPDATED_AUTHORS = 0;

async function authorExists(name: string) {
  const row = await db.get("SELECT rowid AS id FROM authors WHERE name = ?", [
    name,
  ]);

  return !!row;
}

/////////////////////////////////////////////////////////////////////////////////////

export async function insertAuthor(name: string, articleId: number) {
  const alreadyExistsAuthor = await authorExists(name);

  if (!alreadyExistsAuthor) {
    await db.run("INSERT INTO authors (name) VALUES (?)", [name]);
    CREATED_AUTHORS++;
  }

  const authorId = await db.get<Author>(
    "SELECT id FROM authors WHERE name = ?",
    [name]
  );

  // Check if author article relation already exists

  const alreadyExistsAuthorArticle = await db.get(
    "SELECT * FROM article_author WHERE articleId = ? AND authorId = ?",
    [articleId, authorId.id]
  );

  if (!alreadyExistsAuthorArticle) {
    await db.run(
      "INSERT INTO article_author (articleId, authorId) VALUES (?, ?)",
      [articleId, authorId.id]
    );
    UPDATED_AUTHORS++;
  }
}

export const getCreatedAuthors = () => CREATED_AUTHORS;
export const getUpdatedAuthors = () => UPDATED_AUTHORS;
