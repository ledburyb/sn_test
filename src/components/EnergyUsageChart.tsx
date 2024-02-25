"use client";

import { DateTime, Interval } from "luxon";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useSWR from "swr";
import { Well } from "./Well";

// Suppress irritating console warning: https://github.com/recharts/recharts/issues/3615
const error = console.error;
console.error = (...args: any) => {
  if (/defaultProps/.test(args[0])) return;
  error(...args);
};

const fetchUsageData = ({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: number;
  endDate: number;
}) =>
  fetch(
    "/api/usage?" +
      new URLSearchParams({
        userId,
        startDate: String(startDate),
        endDate: String(endDate),
      }).toString()
  ).then((res) => res.json());

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active: boolean;
  payload: any;
  label: string;
}) => {
  if (active && payload && payload.length) {
    // All data is available on both series so we only need the first
    const data = payload[0].payload;
    const timePeriodStart = DateTime.fromSeconds(data.timestamp);
    return (
      <div className="bg-slate-200 p-4 rounded-lg leading-tight text-sm">
        <div className="font-bold mb-1 text-md">
          {timePeriodStart.toFormat("HH:mm")} -{" "}
          {timePeriodStart.plus({ minutes: 30 }).toFormat("HH:mm")}{" "}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col p-2 bg-yellow-500 text-white rounded">
            <div className="text-xs font-bold leading-tight text-yellow-900">
              Electricity
            </div>
            <div>{data.electricityConsumption.toFixed(2)} kWh</div>
            <div>{data.electricityCost} pence</div>
          </div>
          <div className="flex flex-col p-2 bg-blue-500 text-white rounded">
            <div className="text-xs font-bold leading-tight text-blue-900">
              Gas
            </div>
            <p>{data.gasConsumption.toFixed(2)} kWh</p>
            <p>{data.gasCost} pence</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export const EnergyUsageChart = () => {
  // TODO: In a production system the date parameters would be stateful and the userId would
  // probably come from session data
  const userId = "1";
  const startDate = DateTime.fromObject({
    year: 2024,
    month: 1,
    day: 25,
  }).toSeconds()!;
  const endDate = DateTime.fromObject({
    year: 2024,
    month: 1,
    day: 26,
  }).toSeconds()!;

  const { data, error } = useSWR(
    [userId, startDate, endDate],
    ([userId, startDate, endDate]) =>
      fetchUsageData({ userId, startDate, endDate }),
    { suspense: true }
  );

  if (error) return <div>Failed to load</div>;
  if (!data) return <div></div>;

  const ticks = Interval.fromDateTimes(
    DateTime.fromSeconds(data[0].timestamp),
    DateTime.fromSeconds(data[data.length - 1].timestamp)
  )
    .splitBy({ minute: 30 })
    .map((i) => i.start!.toSeconds())
    .filter((_, i) => i % 8 == 0);

  return (
    <BarChart
      width={600}
      height={300}
      data={data}
      margin={{
        top: 24,
        left: -28,
      }}
    >
      <CartesianGrid stroke="#eee" vertical={false} />

      <XAxis
        type="number"
        dataKey="timestamp"
        interval={0}
        tickFormatter={(timeStr) =>
          DateTime.fromSeconds(timeStr).toFormat("HH:mm")
        }
        ticks={ticks}
        domain={[
          data[0].timestamp - 30 * 60,
          data[data.length - 1].timestamp + 60 * 30,
        ]}
      />
      <YAxis
        label={{
          value: "Price (pence)",
          angle: -90,
          position: "middle",
        }}
        width={90}
      />
      <Tooltip
        content={<CustomTooltip />}
        labelFormatter={(v) => DateTime.fromSeconds(v).toFormat("HH:mm")}
      />
      <Legend />
      <Bar dataKey="gasCost" stackId="a" fill="#3b82f6" name="Gas Cost" />
      <Bar
        dataKey="electricityCost"
        stackId="a"
        fill="#facc15"
        name="Electricity Cost"
      />
    </BarChart>
  );
};

export const EnergyUsage = () => {
  return (
    <Well className="min-h-[300px]">
      <h1 className="text-xl font-bold mb-3">Energy usage</h1>
      <EnergyUsageChart />
    </Well>
  );
};

export default EnergyUsage;
