import { describe, expect, it } from "vitest";
import {
  classifyOfficePreview,
  dataUrlToBlob,
  dataUrlToUint8Array,
} from "../officePreview";

describe("officePreview helpers", () => {
  it("classifies office preview kind by extension", () => {
    expect(classifyOfficePreview("paper.PDF")).toBe("pdf");
    expect(classifyOfficePreview("report.docx")).toBe("docx");
    expect(classifyOfficePreview("deck.pptx")).toBe("pptx");
    expect(classifyOfficePreview("legacy.ppt")).toBe("unsupported");
    expect(classifyOfficePreview("data.xlsx")).toBe("xlsx");
    expect(classifyOfficePreview("budget.XLSX")).toBe("xlsx");
    expect(classifyOfficePreview("legacy.xls")).toBe("unsupported");
  });

  it("converts data url to bytes and blob", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8=";
    const bytes = dataUrlToUint8Array(dataUrl);
    const blob = dataUrlToBlob(dataUrl);

    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
    expect(blob.size).toBe(5);
    expect(blob.type).toBe("text/plain");
  });
});
