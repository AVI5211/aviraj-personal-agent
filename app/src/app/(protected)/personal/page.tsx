import { AccountsManager } from "@/components/AccountsManager";
import { ModuleDashboard } from "@/components/ModuleDashboard";

export default function PersonalPage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Personal Finance</h1>
      <AccountsManager />
      <ModuleDashboard module="personal" title="Personal Cash & Expenses" />
    </div>
  );
}
