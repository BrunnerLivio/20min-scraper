import { AsyncDatabase } from "promised-sqlite3";

export const db = await AsyncDatabase.open("./data/db.sqlite");
