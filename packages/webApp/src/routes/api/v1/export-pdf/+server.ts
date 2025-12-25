import { markdownToPdf } from "$lib/server/pdf";
import { json } from "@sveltejs/kit";

export async function POST({ request }) {
  const { html, filename } = await request.json();

  try {
    const pdf = await markdownToPdf(html);

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return json({ error: String(error) }, { status: 500 });
  }
}
