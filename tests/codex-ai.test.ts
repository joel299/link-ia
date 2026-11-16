import { describe, expect, it } from "vitest";
import { extractCodexUserCode, getCodexDeviceLoginStatus, getCodexLoginFailureMessage } from "../src/lib/codex-ai";

describe("Codex device login completion", () => {
  it("treats successful CLI exit as connected and failures as disconnected", () => {
    expect(getCodexDeviceLoginStatus(0)).toBe("connected");
    expect(getCodexDeviceLoginStatus(1)).toBe("disconnected");
    expect(getCodexDeviceLoginStatus(null)).toBe("disconnected");
  });
});

describe("Codex device-code output", () => {
  it("extracts the code from the official CLI prompt with ANSI colors", () => {
    const output = "Follow these steps to sign in using device code authorization:\n2. Enter this one-time code (expires in 15 minutes)\n \u001b[34mABCD-12345\u001b[0m\n";
    expect(extractCodexUserCode(output)).toBe("ABCD-12345");
  });

  it("accepts an unhyphenated nine-character code only after the exact CLI prompt", () => {
    expect(extractCodexUserCode("Enter this one-time code (expires in 15 minutes)\n ABCDE1234")).toBe("ABCDE1234");
  });

  it("rejects the word authorization in the CLI introduction as a code", () => {
    expect(extractCodexUserCode("Follow these steps to sign in with ChatGPT using device code authorization:")).toBeNull();
    expect(extractCodexUserCode("Enter this one-time code (expires in 15 minutes)\n authorization")).toBeNull();
  });

  it("rejects an unlabeled code-like string", () => {
    expect(extractCodexUserCode("\n ABCD-12345\n")).toBeNull();
  });

  it("extracts a strictly formatted user_code from a device URL", () => {
    expect(extractCodexUserCode("Open https://auth.openai.com/codex/device?user_code=PQRS-6789")).toBe("PQRS-6789");
    expect(extractCodexUserCode("Open https://auth.openai.com/codex/device?user_code=authorization")).toBeNull();
  });
});
describe("Codex device login errors", () => {
  it("explains when device-code login is disabled without exposing CLI output", () => {
    const message = getCodexLoginFailureMessage("device code login is not enabled for this Codex server");
    expect(message).toContain("configurações de segurança do ChatGPT");
    expect(message).not.toContain("device code login is not enabled");
  });

  it("explains the exact message emitted when ChatGPT login is disabled", () => {
    const message = getCodexLoginFailureMessage("ChatGPT login is disabled.");
    expect(message).toContain("bloqueado pela configuração de segurança");
    expect(message).not.toContain("ChatGPT login is disabled");
  });

  it("does not expose arbitrary CLI output", () => {
    const message = getCodexLoginFailureMessage("network failure with private diagnostic");
    expect(message).toContain("encerrou antes de gerar o código");
    expect(message).not.toContain("private diagnostic");
  });
});
