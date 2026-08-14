import Database from "better-sqlite3";
import { join, resolve } from "node:path";

export function openRailshotDatabase(): Database.Database {
  const configuredPath = process.env.RAILSHOT_DATABASE_PATH;
  const databasePath = configuredPath
    ? resolve(/* turbopackIgnore: true */ configuredPath)
    : join(process.cwd(), "data", "railshot.sqlite");

  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  database.pragma("foreign_keys = ON");
  return database;
}
