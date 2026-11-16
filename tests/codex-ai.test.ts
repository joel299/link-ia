import { describe, expect, it } from "vitest";
import { extractCodexUserCode } from "../src/lib/codex-ai";

describe("Codex device-code output", () => {
  it("extracts the code from the current CLI prompt with expiry text and ANSI colors", () => {
    const output = "2. Enter this one-time code (expires in 15 minutes)\n \u001b[34mABCD-EFGH\u001b[0m\n";
    expect(extractCodexUserCode(output)).toBe("ABCD-EFGH");
  });

  it("accepts an unhyphenated code after the prompt", () => {
    expect(extractCodexUserCode("Enter this one-time code (expires in 15 minutes)\n ABCDEFGH")).toBe("ABCDEFGH");
  });

  it("extracts a code printed after a generic device-auth prompt", () => {
    expect(extractCodexUserCode("Enter the 9-character code shown in your terminal: WXYZ-1234")).toBe("WXYZ-1234");
  });
});
