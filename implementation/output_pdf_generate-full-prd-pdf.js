const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "docs", "esai-premium-dashboard-full-prd.md");
const out = path.join(__dirname, "esai-premium-dashboard-full-prd.pdf");

const pageW = 595.28;
const pageH = 841.89;
const margin = 44;
const maxW = pageW - margin * 2;

function clean(text) {
  return String(text)
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\|/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "-")
    .trim();
}

function esc(text) {
  return clean(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(text, maxChars) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

class Pdf {
  constructor() {
    this.pages = [];
    this.current = null;
    this.y = pageH - margin;
  }

  newPage() {
    this.current = [];
    this.pages.push(this.current);
    this.y = pageH - margin;
    this.text(margin, 24, `ESAI Full PRD - Page ${this.pages.length}`, 8, "F1", "0.45 0.48 0.54");
  }

  cmd(value) {
    if (!this.current) this.newPage();
    this.current.push(value);
  }

  ensure(height) {
    if (this.y - height < margin + 20) this.newPage();
  }

  text(x, y, text, size = 10, font = "F1", color = "0 0 0") {
    this.cmd(`${color} rg BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(text)}) Tj ET`);
  }

  line(y) {
    this.cmd(`0.84 0.87 0.91 RG 0.7 w ${margin.toFixed(2)} ${y.toFixed(2)} m ${(pageW - margin).toFixed(2)} ${y.toFixed(2)} l S`);
  }

  h1(text) {
    this.ensure(46);
    this.text(margin, this.y, clean(text).replace(/^#\s+/, ""), 20, "F2", "0.05 0.07 0.11");
    this.y -= 30;
  }

  h2(text) {
    this.ensure(42);
    this.line(this.y + 8);
    this.text(margin, this.y - 8, clean(text).replace(/^##\s+/, ""), 13, "F2", "0.06 0.09 0.13");
    this.y -= 30;
  }

  h3(text) {
    this.ensure(28);
    this.text(margin, this.y, clean(text).replace(/^###\s+/, ""), 10.5, "F2", "0.09 0.12 0.18");
    this.y -= 16;
  }

  para(text, indent = 0) {
    const lines = wrap(text, indent ? 84 : 92);
    if (!lines.length) {
      this.y -= 6;
      return;
    }
    this.ensure(lines.length * 12.5 + 6);
    for (const line of lines) {
      this.text(margin + indent, this.y, line, 9.2, "F1", "0.16 0.20 0.27");
      this.y -= 12.5;
    }
    this.y -= 3;
  }

  bullet(text) {
    const lines = wrap(text.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""), 84);
    this.ensure(lines.length * 12.5 + 4);
    this.text(margin + 4, this.y, "-", 9.2, "F2", "0.03 0.45 0.34");
    this.text(margin + 18, this.y, lines[0] || "", 9.2, "F1", "0.16 0.20 0.27");
    this.y -= 12.5;
    for (const line of lines.slice(1)) {
      this.text(margin + 18, this.y, line, 9.2, "F1", "0.16 0.20 0.27");
      this.y -= 12.5;
    }
    this.y -= 2;
  }

  code(lines) {
    const cleaned = lines.map(clean).filter(Boolean);
    this.ensure(Math.min(cleaned.length, 12) * 11 + 18);
    this.cmd(`0.07 0.09 0.13 rg ${margin.toFixed(2)} ${(this.y - cleaned.length * 11 - 12).toFixed(2)} ${maxW.toFixed(2)} ${(cleaned.length * 11 + 16).toFixed(2)} re f`);
    let y = this.y - 14;
    for (const line of cleaned.slice(0, 16)) {
      this.text(margin + 10, y, line.slice(0, 96), 8, "F3", "0.90 0.94 0.92");
      y -= 11;
    }
    this.y = y - 8;
  }

  build() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };
    objects.push("pending catalog", "pending pages");
    const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const monoId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
    const pageIds = [];
    for (const page of this.pages) {
      const stream = page.join("\n");
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`);
      const pageId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R /F3 ${monoId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }
    objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((obj, i) => {
      offsets.push(Buffer.byteLength(pdf, "binary"));
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, "binary");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return pdf;
  }
}

const md = fs.readFileSync(src, "utf8").split(/\r?\n/);
const doc = new Pdf();
let inCode = false;
let codeLines = [];

for (const raw of md) {
  const line = raw.trimEnd();
  if (line.startsWith("```")) {
    if (inCode) {
      doc.code(codeLines);
      codeLines = [];
      inCode = false;
    } else {
      inCode = true;
    }
    continue;
  }
  if (inCode) {
    codeLines.push(line);
    continue;
  }
  if (!line.trim()) {
    doc.para("");
  } else if (line.startsWith("# ")) {
    doc.h1(line);
  } else if (line.startsWith("## ")) {
    doc.h2(line);
  } else if (line.startsWith("### ")) {
    doc.h3(line);
  } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
    doc.bullet(line);
  } else if (line.startsWith("|")) {
    doc.para(line);
  } else {
    doc.para(line);
  }
}

fs.writeFileSync(out, doc.build(), "binary");
console.log(out);
