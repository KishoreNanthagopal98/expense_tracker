export type EntryType = "Expense" | "Income";

export interface AppUser {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  type: EntryType;
  paymentMethod: string;
  notes: string;
  userId: string;
  user: string;
}

export type ExpenseInput = Omit<Expense, "id" | "user">;

export type SavingType = "Deposit" | "Withdrawal";

export interface Saving {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: SavingType;
  userId: string;
  user: string;
  notes: string;
}

export type SavingInput = Omit<Saving, "id" | "user">;

export const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Fuel",
  "Shopping",
  "Health",
  "Education",
  "Entertainment",
  "Travel",
  "EMI / Loans",
  "Insurance",
  "Investments",
  "Gifts",
  "Salary",
  "Other",
];

export const PAYMENT_METHODS = ["UPI", "Cash", "Credit Card", "Debit Card", "Bank Transfer", "Other"];

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
