"use client";

import dynamic from "next/dynamic";
import HomeFinanceLoading from "./loading";

const HomeFinanceDashboard = dynamic(
  () => import("./HomeFinanceDashboard"),
  {
    ssr: false,
    loading: () => <HomeFinanceLoading />,
  }
);

export default function HomeFinancePage() {
  return <HomeFinanceDashboard />;
}
