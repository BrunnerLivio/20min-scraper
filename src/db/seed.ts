import { db } from "./db.js";
import articleSeed from "../article/seed.js";
import commentSeed from "../comment/seed.js";

export async function seed() {
  await articleSeed();
  await commentSeed();
}
