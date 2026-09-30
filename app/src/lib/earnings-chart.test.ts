import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { buildEarningsChart, chartRange } from "@/lib/earnings-chart";
import type { SalaryRecordDoc } from "@/lib/salary";
import type { ClientDoc, WorkLogDoc } from "@/lib/freelance";
import type { TransactionDoc } from "@/lib/transactions";

describe("Overview income chart", () => {
  const clientId = new ObjectId();
  const clients = [{ _id: clientId, currency: "USD", hourlyRateMinor: 1500 }] as ClientDoc[];
  const salary = [{ month: "2026-09", status: "received", grossPaise: 11679500, pfEmployerPaise: 0, otherCtcComponentsPaise: 0 }] as SalaryRecordDoc[];
  const logs = [{ clientId, date: "2026-09-24", billableHours: 13 }] as WorkLogDoc[];
  const transactions = [
    { module: "shop", type: "income", category: "shop_sales", transactionDate: "2026-09-24", amountPaise: 217000 },
    { module: "personal", type: "income", category: "money_return", transactionDate: "2026-09-24", amountPaise: 500000 },
  ] as TransactionDoc[];

  it("totals one day of salary, logged freelance work and shop revenue", () => {
    const points = buildEarningsChart("custom", "2026-09-25", transactions, salary, logs, clients, 96,
      { from: "2026-09-24", to: "2026-09-24" });
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ salary: 389317, freelance: 1872000, shop: 217000, personal: 0, total: 2478317 });
  });

  it("allocates the exact monthly CTC across all 30 days", () => {
    const points = buildEarningsChart("lastMonth", "2026-10-01", transactions, salary, logs, clients, 96);
    expect(points).toHaveLength(30);
    expect(points.reduce((sum, point) => sum + point.salary, 0)).toBe(11679500);
    expect(points.find((point) => point.date === "2026-09-24")?.total).toBe(2478317);
  });

  it("groups the financial year by month", () => {
    const range = chartRange("fy", "2026-10-01");
    expect(range).toEqual({ from: "2026-04-01", to: "2026-10-01", granularity: "month" });
    const points = buildEarningsChart("fy", "2026-10-01", transactions, salary, logs, clients, 96);
    expect(points.map((point) => point.date)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(points.find((point) => point.date === "2026-09")?.salary).toBe(11679500);
  });
});
