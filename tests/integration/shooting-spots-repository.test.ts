import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listApprovedShootingSpots } from "@/server/repositories/shooting-spots";

let database: Database.Database;

beforeEach(() => {
  database = new Database(":memory:");
  database.exec(`
    CREATE TABLE shooting_spots (
      id TEXT PRIMARY KEY,
      name TEXT,
      latitude REAL,
      longitude REAL,
      nearest_station TEXT,
      walk_minutes INTEGER,
      camera_bearing REAL,
      notes TEXT,
      safety_status TEXT
    );

    INSERT INTO shooting_spots VALUES
      ('APPROVED_B', '承認地点B', 35.2, 139.2, 'B駅', 8, 270, '公開歩道', 'approved'),
      ('PENDING', '確認中地点', 35.3, 139.3, 'C駅', 5, 90, '安全確認中', 'pending'),
      ('APPROVED_A', '承認地点A', 35.1, 139.1, 'A駅', 6, 180, '公園内', 'approved');
  `);
});

afterEach(() => database.close());

describe("shooting spots repository", () => {
  it("returns only approved spots in stable order", () => {
    const spots = listApprovedShootingSpots(database);

    expect(spots.map((spot) => spot.id)).toEqual([
      "APPROVED_A",
      "APPROVED_B",
    ]);
    expect(spots[0]).toEqual({
      id: "APPROVED_A",
      name: "承認地点A",
      latitude: 35.1,
      longitude: 139.1,
      nearestStation: "A駅",
      walkMinutes: 6,
      cameraBearing: 180,
      notes: "公園内",
      safetyStatus: "approved",
    });
  });
});
