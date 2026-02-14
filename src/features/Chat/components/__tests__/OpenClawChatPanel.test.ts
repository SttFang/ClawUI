import { describe, expect, it } from "vitest";
import { buildMessageWithPendingImagePlaceholders } from "../OpenClawChatPanel";

describe("buildMessageWithPendingImagePlaceholders", () => {
  it("returns trimmed text when no images are provided", () => {
    expect(
      buildMessageWithPendingImagePlaceholders({
        text: "  hello world  ",
        images: [],
      }),
    ).toBe("hello world");
  });

  it("appends pending image placeholder block", () => {
    const output = buildMessageWithPendingImagePlaceholders({
      text: "describe this image",
      images: [
        {
          id: "img-1",
          filename: "cat.png",
          mediaType: "image/png",
          size: 1234,
        },
      ],
    });

    expect(output).toContain("describe this image");
    expect(output).toContain("[image_attachments_pending]");
    expect(output).toContain("filename: cat.png");
    expect(output).toContain("[/image_attachments_pending]");
  });

  it("returns placeholder block only when text is empty", () => {
    const output = buildMessageWithPendingImagePlaceholders({
      text: "   ",
      images: [
        {
          id: "img-2",
          filename: "dog.jpg",
          mediaType: "image/jpeg",
          size: 2048,
        },
      ],
    });

    expect(output.startsWith("[image_attachments_pending]")).toBe(true);
    expect(output).not.toContain("\n\n[image_attachments_pending]");
  });
});
