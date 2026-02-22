import { describe, it, expect } from "vitest";
import { extractButtons } from "../../src/lib/utils.js";

describe("extractButtons", () => {
  it("extracts buttons from trailing bullet list", () => {
    const text = `Here are some options:
- [Create Campaign]
- [View Analytics]
- [Send Email]`;
    const buttons = extractButtons(text);
    expect(buttons).toEqual([
      { label: "Create Campaign", value: "Create Campaign" },
      { label: "View Analytics", value: "View Analytics" },
      { label: "Send Email", value: "Send Email" },
    ]);
  });

  it("extracts buttons with asterisk bullets", () => {
    const text = `Done! Here's what you can do next:
* [Publish]
* [Edit Draft]`;
    const buttons = extractButtons(text);
    expect(buttons).toEqual([
      { label: "Publish", value: "Publish" },
      { label: "Edit Draft", value: "Edit Draft" },
    ]);
  });

  it("returns empty array when no buttons", () => {
    const text = "Just a regular response with no buttons.";
    expect(extractButtons(text)).toEqual([]);
  });

  it("only extracts trailing buttons (ignores mid-text brackets)", () => {
    const text = `Check out [this link] for more info.

Some more text here.
- [Action One]
- [Action Two]`;
    const buttons = extractButtons(text);
    expect(buttons).toEqual([
      { label: "Action One", value: "Action One" },
      { label: "Action Two", value: "Action Two" },
    ]);
  });

  it("handles empty string", () => {
    expect(extractButtons("")).toEqual([]);
  });
});
