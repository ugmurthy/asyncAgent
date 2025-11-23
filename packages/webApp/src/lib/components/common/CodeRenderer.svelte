<script lang="ts">
  import hljs from "highlight.js";
  //import "highlight.js/styles/github.css";
  import "highlight.js/styles/atom-one-dark-reasonable.css";
  interface Props {
    lang?: string;
    text?: string;
  }

  const { lang = "", text = "" }: Props = $props();

  const html =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(text, { language: lang }).value
      : hljs.highlightAuto(text).value;
</script>

<pre><code class={lang ? `language-${lang}` : ""}>
  {@html html}
</code></pre>
