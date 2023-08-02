import { RunResult } from "sqlite3";
import { db } from "../db/db.js";
import { Comment } from "./comment.js";

let UPDATED_COMMENTS = 0;
let CREATED_COMMENTS = 0;

async function commentExists(articleId: string, content: string) {
  return await db.get<Comment>(
    "SELECT rowid AS id FROM comments WHERE articleId = ? AND content = ?",
    [articleId, content]
  );
}

export async function insertComment(
  articleId: number,
  parentId: number = null,
  comment: Comment
) {
  const alreadyExistsComment = await commentExists(
    articleId.toString(),
    comment.content
  );

  let newComment: RunResult;
  if (alreadyExistsComment) {
    UPDATED_COMMENTS++;
    newComment = await db.run(
      "UPDATE comments SET reactions_quatsch = ?, reactions_unnoetig = ?, reactions_genau = ?, reactions_love_it = ?, reactions_smart = ?, reactions_so_nicht = ? WHERE rowid = ?",
      [
        comment.reactions_quatsch,
        comment.reactions_unnoetig,
        comment.reactions_genau,
        comment.reactions_love_it,
        comment.reactions_smart,
        comment.reactions_so_nicht,
        alreadyExistsComment.id,
      ]
    );
  } else {
    CREATED_COMMENTS++;
    newComment = await db.run(
      "INSERT INTO comments (author, createdAt, content, reactions_quatsch, reactions_unnoetig, reactions_genau, reactions_love_it, reactions_smart, reactions_so_nicht, articleId, parentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        comment.author,
        comment.createdAt,
        comment.content,
        comment.reactions_quatsch,
        comment.reactions_unnoetig,
        comment.reactions_genau,
        comment.reactions_love_it,
        comment.reactions_smart,
        comment.reactions_so_nicht,
        articleId,
        parentId,
      ]
    );
  }

  if (comment.subComments) {
    await Promise.all(
      comment.subComments.map(async (subComment) => {
        await insertComment(articleId, newComment.lastID, subComment);
      })
    );
  }
}

export const getUpdatedComments = () => UPDATED_COMMENTS;
export const getCreatedComments = () => CREATED_COMMENTS;
