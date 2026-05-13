const MAX_TEXT_LENGTH = 200_000;

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

export async function extractText(file: File): Promise<string> {
  const mime = file.type.toLowerCase();

  if (mime === "text/plain" || mime === "text/markdown") {
    return truncate(await file.text());
  }

  if (mime === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    return truncate(result.text ?? "");
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return truncate(result.value ?? "");
  }

  return "";
}
