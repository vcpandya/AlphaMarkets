import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export async function exportAsHTML(element: HTMLElement, filename = "report") {
  const clone = element.cloneNode(true) as HTMLElement;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AlphaMarkets Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1117; color: #f1f5f9; padding: 2rem; }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
${clone.innerHTML}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  saveAs(blob, `${filename}.html`);
}

export async function exportAsPDF(element: HTMLElement, filename = "report") {
  const canvas = await html2canvas(element, {
    backgroundColor: "#0f1117",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}

export async function exportAsWord(element: HTMLElement, filename = "report") {
  const textContent = element.innerText || element.textContent || "";
  const lines = textContent.split("\n").filter((l) => l.trim());

  const children: Paragraph[] = [
    new Paragraph({
      text: "AlphaMarkets Analysis Report",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString()}`,
      spacing: { after: 400 },
    }),
  ];

  for (const line of lines) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line })],
        spacing: { after: 120 },
      }),
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
