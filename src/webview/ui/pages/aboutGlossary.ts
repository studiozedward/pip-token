import { glossaryContent } from './glossaryContent';
import { renderMascot } from '../components/mascotPanel';

/**
 * Hand-rolled minimal markdown-subset renderer.
 * Handles: ## headings, ### term headings, ---, **bold**, `code`,
 * code blocks (```), - list items, and paragraphs.
 * No libraries.
 */
function renderMarkdown(source: string): string {
  const lines = source.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let paragraphLines: string[] = [];

  function flushParagraph(): void {
    if (paragraphLines.length > 0) {
      const text = inlineFormat(paragraphLines.join(' '));
      output.push(`<p class="glossary-p">${text}</p>`);
      paragraphLines = [];
    }
  }

  function inlineFormat(text: string): string {
    // Bold: **text**
    let result = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Inline code: `text`
    result = result.replace(/`([^`]+)`/g, '<code class="glossary-code">$1</code>');
    return result;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        output.push(`<pre class="glossary-pre">${escapeHtml(codeBlockLines.join('\n'))}</pre>`);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Skip # Heading 1 (top-level)
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      flushParagraph();
      continue;
    }

    // ### Term Heading (check before ##)
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      const text = trimmed.slice(4);
      output.push(`<div class="glossary-term">${escapeHtml(text)}</div>`);
      continue;
    }

    // ## Section Heading
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      const text = trimmed.slice(3);
      output.push(`<div class="glossary-section">${escapeHtml(text)}</div>`);
      continue;
    }

    // Horizontal rule
    if (trimmed === '---') {
      flushParagraph();
      output.push('<hr class="glossary-hr">');
      continue;
    }

    // List item
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      const text = inlineFormat(trimmed.slice(2));
      output.push(`<div class="glossary-li">\u2022 ${text}</div>`);
      continue;
    }

    // Empty line = end of paragraph
    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // Regular text = accumulate into paragraph
    paragraphLines.push(trimmed);
  }

  // Flush remaining
  flushParagraph();

  // Close any unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    output.push(`<pre class="glossary-pre">${escapeHtml(codeBlockLines.join('\n'))}</pre>`);
  }

  return output.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderAboutGlossary(container: HTMLElement): void {
  const renderedHtml = renderMarkdown(glossaryContent);

  container.innerHTML = `
    <div class="page-content" style="padding: 8px 0; max-height: 400px; overflow-y: auto;">
      ${renderedHtml}
      <div class="mascot" id="mascot-glossary" style="padding-top: 16px;"></div>
    </div>
  `;

  const mascotEl = container.querySelector('#mascot-glossary') as HTMLElement;
  if (mascotEl) {
    renderMascot(mascotEl, 'about', 'Every term used in Pip-Token, defined in one place.');
  }
}
