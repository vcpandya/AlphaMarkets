import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export function exportAsPdf(element: HTMLElement, title: string): void {
  const filename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  html2canvas(element, {
    backgroundColor: "#0f0f1a",
    scale: 2,
    useCORS: true,
    logging: false,
  }).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;

    const contentWidth = pageWidth - margin * 2;
    const scaleFactor = contentWidth / imgWidth;
    const scaledHeight = imgHeight * scaleFactor;
    const contentHeight = pageHeight - margin * 2;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    let yOffset = 0;
    let pageIndex = 0;

    while (yOffset < scaledHeight) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      // Calculate source region in canvas pixels
      const sourceY = yOffset / scaleFactor;
      const sourceHeight = Math.min(contentHeight / scaleFactor, imgHeight - sourceY);

      // Create a sub-canvas for this page
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = imgWidth;
      pageCanvas.height = Math.ceil(sourceHeight);
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          imgWidth,
          sourceHeight,
          0,
          0,
          imgWidth,
          sourceHeight,
        );
      }

      const pageImgData = pageCanvas.toDataURL("image/png");
      const drawHeight = sourceHeight * scaleFactor;

      pdf.addImage(pageImgData, "PNG", margin, margin, contentWidth, drawHeight);

      yOffset += contentHeight;
      pageIndex++;
    }

    pdf.save(filename);
  });
}
