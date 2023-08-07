import { AsyncDatabase } from "promised-sqlite3";

console.log(process.env.TWENTY_MIN_DB_FILE);
export const db = await AsyncDatabase.open(
  process.env.TWENTY_MIN_DB_FILE || "./data/db.sqlite"
);
