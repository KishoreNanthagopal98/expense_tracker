import SavingsPage from "@/components/SavingsPage";
import SavingsPasswordGate from "@/components/SavingsPasswordGate";

export default function Savings() {
  return (
    <SavingsPasswordGate>
      <SavingsPage />
    </SavingsPasswordGate>
  );
}
