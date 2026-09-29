import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { buildOwnerWorkbook, safeText } from "@/server/exports/xlsx";
import { createOrder } from "@/server/orders/service";
import { orderInput, setTestEnv, setupTestDb } from "./helpers";

describe("owner Excel export", () => {
  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
    await createOrder(
      orderInput({ includeQuestions: true, questions: ["=HYPERLINK(\"http://evil\",\"click\") is this safe?", "+SUM(A1:A9) what about this one?", "நான் எந்த துறையில் முன்னேறலாம்?"], additionalContext: "@evil context" }, { subjectName: "=cmd|' /C calc'!A0" }),
      "xlsx-1",
    );
    await createOrder(orderInput({}, { subjectName: "முருகன் செல்வம்" }), "xlsx-2");
  });

  it("neutralises text that spreadsheets would execute as a formula", () => {
    expect(safeText("=1+1")).toBe("'=1+1");
    expect(safeText("+91 98765")).toBe("'+91 98765");
    expect(safeText("-5")).toBe("'-5");
    expect(safeText("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeText("Normal name")).toBe("Normal name");
    expect(safeText(null)).toBeNull();
  });

  it("writes typed, Unicode-safe sheets joined by order ID", async () => {
    const { buffer, counts } = await buildOwnerWorkbook(await getDb(), { from: null, to: null });
    expect(counts.orders).toBe(2);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["About", "Orders", "Participants", "Questions", "Shared context", "Report status", "Payments", "By product"]);
    const col = (sheet: ExcelJS.Worksheet, header: string) => {
      let index = 0;
      sheet.getRow(1).eachCell((cell, i) => {
        if (cell.value === header) index = i;
      });
      expect(index, header).toBeGreaterThan(0);
      return index;
    };

    const orders = wb.getWorksheet("Orders")!;
    expect(orders.getRow(1).getCell(1).value).toBe("Order ID");
    const total = orders.getRow(2).getCell(col(orders, "Total (₹)")).value;
    expect(orders.getRow(2).getCell(col(orders, "Product")).value).toBe("personal");
    expect(typeof total).toBe("number");
    expect([49, 69]).toContain(total);
    expect(orders.getRow(2).getCell(3).value).toBeInstanceOf(Date);

    const birth = wb.getWorksheet("Participants")!;
    const nameCol = col(birth, "Name");
    const names = [birth.getRow(2).getCell(nameCol).value, birth.getRow(3).getCell(nameCol).value];
    expect(names).toContain("'=cmd|' /C calc'!A0");
    expect(names).toContain("முருகன் செல்வம்");
    expect(birth.getRow(2).getCell(col(birth, "Birth date")).value).toBeInstanceOf(Date);
    expect(birth.getRow(2).getCell(col(birth, "Participant #")).value).toBe(1);

    const questions = wb.getWorksheet("Questions")!;
    const qCells = [2, 3, 4].map((r) => questions.getRow(r).getCell(4));
    expect(qCells[0]!.value).toMatch(/^'=HYPERLINK/);
    expect(qCells[1]!.value).toMatch(/^'\+SUM/);
    expect(qCells[2]!.value).toBe("நான் எந்த துறையில் முன்னேறலாம்?");
    // No cell anywhere is an actual formula.
    for (const sheet of wb.worksheets) {
      sheet.eachRow((row) => row.eachCell((cell) => expect(cell.type).not.toBe(ExcelJS.ValueType.Formula)));
    }
  });

  it("filters by order date", async () => {
    const { counts } = await buildOwnerWorkbook(await getDb(), { from: "2000-01-01", to: "2000-12-31" });
    expect(counts.orders).toBe(0);
  });
});
