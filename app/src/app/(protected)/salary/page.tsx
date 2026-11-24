import { SalaryManager } from "@/components/SalaryManager";
import { SalarySpikeManager } from "@/components/SalarySpikeManager";
import { isSalarySpikeEnabled } from "@/lib/env";

// The flag is read at request time, so the page must not be prerendered at build.
export const dynamic = "force-dynamic";

export default function SalaryPage() {
  return isSalarySpikeEnabled() ? <SalarySpikeManager /> : <SalaryManager />;
}
