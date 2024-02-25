import { DateTime, Interval } from "luxon";
import { EnergyType, loadCSVData } from "./dataLoader";

type ElectricityConsumptionRow = {
  timestamp: number;
  "energyConsumption (kWh)": string;
};

type GasConsumptionRow = {
  timestamp: number;
  "energyConsumption (m3)": string;
};

type TariffRow = {
  timestamp: number;
  chargeType: "standingCharge" | "touPrice";
  "standingCharge (pence per day)": string;
  "touPrice (pence per kWh)": string;
};

function m3ToKwh(m3: number) {
  // Estimation using a calorific value of 40
  return (m3 * 40 * 1.02264) / 3.6;
}

async function loadTariffs({
  userId,
  fileDates,
  type,
}: {
  userId: string;
  fileDates: DateTime[];
  startDate: DateTime;
  endDate: DateTime;
  type: EnergyType;
}) {
  const tariffs = await loadCSVData<TariffRow>({
    userId,
    energyType: type,
    dataType: "tariff",
    fileDates,
  });
  const standingCharges: Record<number, number> = {};
  const touPrices: Record<number, number> = {};
  for (const row of tariffs) {
    if (row.chargeType === "standingCharge") {
      standingCharges[row["timestamp"]] = parseFloat(
        row["standingCharge (pence per day)"]
      );
    } else if (row.chargeType === "touPrice") {
      touPrices[row["timestamp"]] = parseFloat(row["touPrice (pence per kWh)"]);
    }
  }
  return touPrices;
}

async function loadElectricityConsumption({
  userId,
  fileDates,
}: {
  userId: string;
  fileDates: DateTime[];
}) {
  return (
    await loadCSVData<ElectricityConsumptionRow>({
      userId,
      energyType: "electricity",
      dataType: "consumption",
      fileDates,
    })
  ).map((row) => {
    return {
      timestamp: row["timestamp"],
      usageKWH: parseFloat(row["energyConsumption (kWh)"]),
    };
  });
}

async function loadGasConsumption({
  userId,
  fileDates,
}: {
  userId: string;
  fileDates: DateTime[];
  startDate: DateTime;
  endDate: DateTime;
}) {
  return (
    await loadCSVData<GasConsumptionRow>({
      userId,
      energyType: "gas",
      dataType: "consumption",
      fileDates,
    })
  ).map((row) => ({
    timestamp: row["timestamp"],
    usageKWH: m3ToKwh(parseFloat(row["energyConsumption (m3)"])),
  }));
}

async function loadElectricityUsage(kwargs: {
  userId: string;
  fileDates: DateTime[];
  startDate: DateTime;
  endDate: DateTime;
}) {
  const touPrices = await loadTariffs({ ...kwargs, type: "electricity" });
  const consumptionData = await loadElectricityConsumption(kwargs);
  const timeSeries: Record<number, { usageKWH: number; cost: string }> = {};
  for (const row of consumptionData) {
    const touPrice =
      touPrices[
        DateTime.fromSeconds(row["timestamp"])
          .minus({ minutes: 30 })
          .toSeconds()
      ];
    timeSeries[row["timestamp"]] = {
      usageKWH: row["usageKWH"],
      cost: (row["usageKWH"] * touPrice).toFixed(2),
    };
  }
  return timeSeries;
}

async function loadGasUsage(kwargs: {
  userId: string;
  fileDates: DateTime[];
  startDate: DateTime;
  endDate: DateTime;
}) {
  const touPrices = await loadTariffs({ ...kwargs, type: "gas" });
  const consumptionData = await loadGasConsumption(kwargs);

  const timeSeries: Record<number, { usageKWH: number; cost: string }> = {};
  for (const row of consumptionData) {
    const touPrice =
      touPrices[
        DateTime.fromSeconds(row["timestamp"])
          .minus({ minutes: 30 })
          .toSeconds()
      ];
    timeSeries[row["timestamp"]] = {
      usageKWH: row["usageKWH"],
      cost: (row["usageKWH"] * touPrice).toFixed(2),
    };
  }
  return timeSeries;
}

export const fetchUsage = async ({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: DateTime;
  endDate: DateTime;
}) => {
  // Because of timezones we may need to fetch more files when BST is active
  const daysToFetch = Interval.fromDateTimes(startDate.startOf("day"), endDate)
    .splitBy({
      day: 1,
    })
    .map((i) => i.start!);

  const electricityUsageData = await loadElectricityUsage({
    userId,
    fileDates: daysToFetch,
    startDate,
    endDate,
  });

  const gasUsageData = await loadGasUsage({
    userId,
    fileDates: daysToFetch,
    startDate,
    endDate,
  });

  const dataPoints: {
    timestamp: number;
    electricityCost: string;
    electricityConsumption: number;
    gasCost: string;
    gasConsumption: number;
  }[] = [];
  Interval.fromDateTimes(startDate.startOf("day"), endDate)
    .splitBy({
      minute: 30,
    })
    .map((i) => {
      const timestamp = i.end!.toSeconds();
      dataPoints.push({
        timestamp: i.start!.toSeconds(),
        electricityCost: electricityUsageData[timestamp].cost,
        electricityConsumption: electricityUsageData[timestamp].usageKWH,
        gasCost: gasUsageData[timestamp].cost,
        gasConsumption: gasUsageData[timestamp].usageKWH,
      });
    });

  return dataPoints;
};
