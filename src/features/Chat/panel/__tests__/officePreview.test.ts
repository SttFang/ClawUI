import { describe, expect, it } from "vitest";
import {
  classifyOfficePreview,
  dataUrlToBlob,
  dataUrlToUint8Array,
  extractPptxSlideTextFromXml,
} from "../officePreview";

describe("officePreview helpers", () => {
  it("classifies office preview kind by extension", () => {
    expect(classifyOfficePreview("paper.PDF")).toBe("pdf");
    expect(classifyOfficePreview("report.docx")).toBe("docx");
    expect(classifyOfficePreview("deck.pptx")).toBe("pptx");
    expect(classifyOfficePreview("legacy.ppt")).toBe("unsupported");
  });

  it("converts data url to bytes and blob", () => {
    const dataUrl = "data:text/plain;base64,SGVsbG8=";
    const bytes = dataUrlToUint8Array(dataUrl);
    const blob = dataUrlToBlob(dataUrl);

    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
    expect(blob.size).toBe(5);
    expect(blob.type).toBe("text/plain");
  });

  it("extracts text lines from pptx slide xml", () => {
    const xml = `
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p>
                  <a:r><a:t>Title</a:t></a:r>
                </a:p>
                <a:p>
                  <a:r><a:t>Point A</a:t></a:r>
                </a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>
    `;

    expect(extractPptxSlideTextFromXml(xml)).toBe("Title\nPoint A");
  });
});
