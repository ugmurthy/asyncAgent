<script lang="ts">
  import MarkdownRenderer from "$lib/components/common/MarkdownRenderer.svelte";

  const testMarkdown = `
# Markdown Test Suite

## 1. Syntax Highlighting
\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

## 2. Mermaid Diagram
\`\`\`mermaid
graph LR
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[End]
  C --> D
\`\`\`

## 3. Markdown Text
**Bold text**, *italic text*, and ~~strikethrough~~.

- Bullet list
- With items

1. Numbered list
2. Second item

## 4. Math Equations
Inline math: $E = mc^2$

Block math:
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$
  `.trim();
</script>

<div class="p-8 max-w-4xl mx-auto">
  <MarkdownRenderer source={testMarkdown} />
</div>
