import { describe, expect, it } from "vitest";

import { extractAgentChoiceFromMessage } from "../agent-choice";

describe("extractAgentChoiceFromMessage", () => {
  it("uses needsUserChoice from message context and leaves prose intact", () => {
    const choice = {
      needs_user_choice: true,
      question: "Continue?",
      options: [{ id: "yes", label: "Yes", description: "Proceed." }],
    };

    const result = extractAgentChoiceFromMessage("Agent prose", { needsUserChoice: choice });

    expect(result.choice).toEqual(choice);
    expect(result.displayText).toBe("Agent prose");
  });

  it("extracts fenced needs_user_choice JSON from saved assistant text", () => {
    const content = [
      "Before",
      "```json",
      JSON.stringify({
        needs_user_choice: true,
        question: "Guidebook unreadable. Next?",
        options: [
          { id: "ocr", label: "OCR", description: "Reupload readable PDF." },
          { id: "continue", label: "Continue", description: "Proceed anyway." },
        ],
      }),
      "```",
      "After",
    ].join("\n");

    const result = extractAgentChoiceFromMessage(content, {});

    expect(result.choice?.question).toBe("Guidebook unreadable. Next?");
    expect(result.displayText).toContain("Before");
    expect(result.displayText).toContain("After");
    expect(result.displayText).not.toContain("needs_user_choice");
  });

  it("builds a conservative fallback card for obvious numbered angle choices", () => {
    const result = extractAgentChoiceFromMessage(
      [
        "Pilih salah satu nomor 1-5.",
        "",
        "1) Angle satu",
        "2) Angle dua",
        "3) Angle tiga",
        "4) Angle empat",
        "5) Angle lima",
      ].join("\n"),
      {},
    );

    expect(result.choice?.question).toMatch(/choose/i);
    expect(result.choice?.options.map((option) => option.id)).toEqual([
      "angle_1",
      "angle_2",
      "angle_3",
      "angle_4",
      "angle_5",
      "revise",
      "fresh_round",
    ]);
  });

  it("does not turn ordinary numbered content into a choice card", () => {
    const result = extractAgentChoiceFromMessage(
      ["Evidence list:", "1) Indonesia has many campuses.", "2) Turnitin threshold is strict."].join("\n"),
      {},
    );

    expect(result.choice).toBeNull();
  });
});
