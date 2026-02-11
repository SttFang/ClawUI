import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageText } from "../MessageText";

describe("MessageText", () => {
  it("should not force pre-wrap or fit-content width on streamdown root", () => {
    const html = renderToStaticMarkup(
      createElement(MessageText, { text: "a\n\n\nb", isAnimating: false }),
    );

    expect(html).not.toContain("whitespace-pre-wrap");
    expect(html).not.toContain("w-fit");
    expect(html).toContain("max-w-full");
  });
});
