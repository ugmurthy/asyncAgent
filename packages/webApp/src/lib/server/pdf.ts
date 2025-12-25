import puppeteer from "puppeteer";

export async function markdownToPdf(htmlContent: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
  });

  await browser.close();

  return pdf;
}
