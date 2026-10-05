import "server-only";
import { google, sheets_v4 } from "googleapis";
import { randomUUID } from "crypto";
import { Expense, ExpenseInput, EntryType, MONTH_RE } from "./types";

// Column layout of every monthly tab. Users can also type rows directly into the sheet;
// rows without an ID are addressed by their row number.
const HEADERS = ["Date", "Description", "Category", "Amount", "Type", "Payment Method", "Notes", "ID"];
const LAST_COL = "H";

export class SetupError extends Error {}

function config() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !email || !key) {
    throw new SetupError(
      "Google Sheets is not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env.local."
    );
  }
  return { spreadsheetId, email, key };
}

let client: sheets_v4.Sheets | null = null;

function api() {
  const { email, key } = config();
  if (!client) {
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    client = google.sheets({ version: "v4", auth });
  }
  return client;
}

function assertMonth(month: string) {
  if (!MONTH_RE.test(month)) throw new Error(`Invalid month "${month}", expected YYYY-MM`);
}

async function getTabs() {
  const { spreadsheetId } = config();
  const res = await api().spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  return (res.data.sheets ?? []).map((s) => ({
    sheetId: s.properties!.sheetId!,
    title: s.properties!.title!,
  }));
}

async function findTab(month: string) {
  return (await getTabs()).find((t) => t.title === month);
}

async function ensureTab(month: string) {
  const existing = await findTab(month);
  if (existing) return existing;

  const { spreadsheetId } = config();
  const res = await api().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: month, gridProperties: { frozenRowCount: 1 } },
          },
        },
      ],
    },
  });
  const sheetId = res.data.replies![0].addSheet!.properties!.sheetId!;

  await api().spreadsheets.values.update({
    spreadsheetId,
    range: `'${month}'!A1:${LAST_COL}1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
  await api().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
      ],
    },
  });
  return { sheetId, title: month };
}

function parseAmount(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseType(v: unknown): EntryType {
  return String(v ?? "").trim().toLowerCase() === "income" ? "Income" : "Expense";
}

function toRow(e: ExpenseInput, id: string) {
  return [e.date, e.description, e.category, e.amount, e.type, e.paymentMethod, e.notes, id];
}

/** Returns all entries for a month, with their 1-based sheet row numbers. */
async function readRows(month: string) {
  const { spreadsheetId } = config();
  const res = await api().spreadsheets.values.get({
    spreadsheetId,
    range: `'${month}'!A2:${LAST_COL}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const rows = res.data.values ?? [];
  const out: { row: number; expense: Expense }[] = [];
  rows.forEach((r, i) => {
    const row = i + 2;
    if (!r.some((c) => String(c ?? "").trim() !== "")) return; // skip blank rows
    out.push({
      row,
      expense: {
        id: String(r[7] ?? "").trim() || `row-${row}`,
        date: String(r[0] ?? ""),
        description: String(r[1] ?? ""),
        category: String(r[2] ?? "") || "Other",
        amount: parseAmount(r[3]),
        type: parseType(r[4]),
        paymentMethod: String(r[5] ?? ""),
        notes: String(r[6] ?? ""),
        userId: "",
        user: "",
      },
    });
  });
  return out;
}

async function locate(month: string, id: string) {
  const match = (await readRows(month)).find((r) => r.expense.id === id);
  if (!match) throw new Error("Entry not found — it may have been changed in the sheet. Refresh and try again.");
  return match;
}

export async function listMonths(): Promise<string[]> {
  return (await getTabs())
    .map((t) => t.title)
    .filter((t) => MONTH_RE.test(t))
    .sort()
    .reverse();
}

export async function listExpenses(month: string): Promise<Expense[]> {
  assertMonth(month);
  if (!(await findTab(month))) return [];
  return (await readRows(month)).map((r) => r.expense);
}

export async function addExpense(month: string, input: ExpenseInput): Promise<Expense> {
  assertMonth(month);
  await ensureTab(month);
  const id = randomUUID();
  await api().spreadsheets.values.append({
    spreadsheetId: config().spreadsheetId,
    range: `'${month}'!A:${LAST_COL}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [toRow(input, id)] },
  });
  return { id, ...input, user: "" };
}

export async function updateExpense(month: string, id: string, input: ExpenseInput): Promise<Expense> {
  assertMonth(month);
  const { row } = await locate(month, id);
  // Rows typed manually get a real ID the first time they're edited in the app.
  const newId = id.startsWith("row-") ? randomUUID() : id;
  await api().spreadsheets.values.update({
    spreadsheetId: config().spreadsheetId,
    range: `'${month}'!A${row}:${LAST_COL}${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [toRow(input, newId)] },
  });
  return { id: newId, ...input, user: "" };
}

export async function deleteExpense(month: string, id: string): Promise<void> {
  assertMonth(month);
  const tab = await findTab(month);
  if (!tab) throw new Error("Month not found");
  const { row } = await locate(month, id);
  await api().spreadsheets.batchUpdate({
    spreadsheetId: config().spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: tab.sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row },
          },
        },
      ],
    },
  });
}
