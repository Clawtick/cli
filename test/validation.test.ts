import { describe, it, expect } from "vitest";
import {
  validateCronExpression,
  validateJobName,
  validateMessage,
  validateWebhookUrl,
} from "../src/validation.js";

describe("validateCronExpression", () => {
  it.each(["*/5 * * * *", "0 9 * * 1-5", "0 9,17 * * *"])("accepts %s", (c) => {
    expect(validateCronExpression(c).valid).toBe(true);
  });
  it("rejects empty and wrong field counts", () => {
    expect(validateCronExpression("").valid).toBe(false);
    expect(validateCronExpression("* * *").valid).toBe(false);
  });
  it("rejects invalid field characters", () => {
    const r = validateCronExpression("a * * * *");
    expect(r.valid).toBe(false);
    expect(r.error).toContain('"a"');
  });
});

describe("validateJobName", () => {
  it("accepts simple names", () => expect(validateJobName("Daily report_1").valid).toBe(true));
  it("rejects empty, too long, and bad characters", () => {
    expect(validateJobName("   ").valid).toBe(false);
    expect(validateJobName("a".repeat(101)).valid).toBe(false);
    expect(validateJobName("bad!name").valid).toBe(false);
  });
});

describe("validateMessage", () => {
  it("accepts normal and rejects empty/oversized", () => {
    expect(validateMessage("hi").valid).toBe(true);
    expect(validateMessage("  ").valid).toBe(false);
    expect(validateMessage("x".repeat(5001)).valid).toBe(false);
  });
});

describe("validateWebhookUrl", () => {
  it("accepts http(s) and rejects other protocols or garbage", () => {
    expect(validateWebhookUrl("https://example.com/hook").valid).toBe(true);
    expect(validateWebhookUrl("ftp://example.com").valid).toBe(false);
    expect(validateWebhookUrl("not a url").valid).toBe(false);
  });
});
