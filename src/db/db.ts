import { AsyncDatabase } from "promised-sqlite3";

export const db = await AsyncDatabase.open(
  process.env.TWENTY_MIN_DB_FILE || "./data/db.sqlite"
);
