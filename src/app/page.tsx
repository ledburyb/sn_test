import dynamic from "next/dynamic";

const EnergyUsageChart = dynamic(
  () => import("@/components/EnergyUsageChart"),
  {
    ssr: false,
  }
);

export default function Home() {
  return (
    <main className="flex flex-col w-full py-24">
      <EnergyUsageChart />
    </main>
  );
}
