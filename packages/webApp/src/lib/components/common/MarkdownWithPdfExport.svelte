<script lang="ts">
  import MarkdownRenderer from "./MarkdownRenderer.svelte";
  import { Download } from "@lucide/svelte";
  import { Button } from "$lib/ui/button";
  import { addNotification } from "$lib/stores/notifications";

  interface Props {
    source: string;
    filename?: string;
  }

  let { source, filename = "document.pdf" }: Props = $props();
  let container: HTMLDivElement | null = null;

  function downloadPdf() {
    if (!container) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addNotification("Please allow popups to download PDF", "error");
      return;
    }

    const doc = printWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head>");
    doc.write("<title>" + filename.replace(".pdf", "") + "</title>");

    // Copy stylesheets
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const styleEl = doc.createElement("style");
        styleEl.textContent = Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
        doc.head.appendChild(styleEl);
      } catch {
        // Skip cross-origin stylesheets
      }
    });

    // Add print-specific styles
    const printStyle = doc.createElement("style");
    printStyle.textContent = "@media print { body { margin: 20mm; } @page { margin: 20mm; } }";
    doc.head.appendChild(printStyle);

    doc.write("</head><body class='prose max-w-none'>");
    doc.write(container.innerHTML);
    doc.write("</body></html>");
    doc.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
</script>

<div>
  <div class="mb-4">
    <Button onclick={downloadPdf} class="flex items-center gap-2">
      <Download size={16} />
      Download PDF
    </Button>
  </div>
  <div
    bind:this={container}
    class="prose max-w-none dark:prose-invert p-4 bg-gray-50 rounded-lg border"
  >
    <MarkdownRenderer {source} />
  </div>
</div>
