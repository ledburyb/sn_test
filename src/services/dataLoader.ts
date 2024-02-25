import csvParser from "csv-parser";
import * as fs from "fs";
import { DateTime } from "luxon";
import * as path from "path";

export type EnergyType = "electricity" | "gas";
export type DataType = "consumption" | "tariff";

const CSV_DATE_FORMAT = "y-LL-dd HH:mm";

function buildFilename({
  userId,
  energyType,
  dataType,
  date,
}: {
  userId: string;
  energyType: EnergyType;
  dataType: DataType;
  date: DateTime;
}) {
  const filename = `${date.toISODate({ format: "basic" })}-${date
    .plus({ days: 1 })
    .toISODate({ format: "basic" })}.csv`;

  // This is only for simplicity in this exercise
  // In production it would live somewhere else like S3 (or more likely an actual database)
  const directory = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "data",
    userId,
    energyType,
    dataType,
    "1",
    filename
  );
  return directory;
}

async function loadCSVRows<T>(filename: string) {
  return new Promise((resolve) => {
    let rows: T[] = [];
    fs.createReadStream(filename)
      .pipe(csvParser())
      .on("data", (data) => {
        rows.push({
          ...data,
          timestamp: DateTime.fromFormat(
            data["timestamp (UTC)"],
            CSV_DATE_FORMAT,
            {
              zone: "UTC",
            }
          ).toSeconds(),
        } as T);
      })
      .on("end", () => {
        resolve(rows);
      });
  });
}

export async function loadCSVData<T>({
  userId,
  energyType,
  dataType,
  fileDates,
}: {
  userId: string;
  energyType: EnergyType;
  dataType: DataType;
  fileDates: DateTime[];
}) {
  const rows: T[] = [];
  for (const date of fileDates) {
    const filename = buildFilename({ userId, energyType, dataType, date });
    rows.push(...((await loadCSVRows(filename)) as T[]));
  }
  return rows;
}
