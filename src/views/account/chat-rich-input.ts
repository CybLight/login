import {
  insertChatBlockquote,
  insertChatCode,
  insertChatFormatting,
  insertChatLink,
} from './chat-editor';
import { parseFormattedChatText } from './chat-format';

// Helper function to convert HTML content editable structure to Markdown syntax
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '_$1_')
    .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '__$1__')
    .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
    .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~')
    .replace(/<span class="spoiler"[^>]*>([\s\S]*?)<\/span>/gi, '||$1||')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote class="chat-blockquote"[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // Strip all other HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = markdown;
  return tempDiv.innerText || tempDiv.textContent || '';
}

// Convert a DOM node and character offset to the corresponding character index in the generated Markdown string
function getMarkdownOffset(root: HTMLElement, targetNode: Node, targetOffset: number): number {
  let markdownOffset = 0;
  let found = false;

  function traverse(node: Node) {
    if (found) return;

    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        markdownOffset += targetOffset;
        found = true;
        return;
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      markdownOffset += node.nodeValue?.length || 0;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toUpperCase();

      let startTag = '';
      let endTag = '';
      switch (tagName) {
        case 'STRONG':
        case 'B':
          startTag = '**'; endTag = '**'; break;
        case 'EM':
        case 'I':
          startTag = '_'; endTag = '_'; break;
        case 'U':
          startTag = '__'; endTag = '__'; break;
        case 'DEL':
        case 'STRIKE':
          startTag = '~~'; endTag = '~~'; break;
        case 'SPAN':
          if (element.classList.contains('spoiler')) {
            startTag = '||'; endTag = '||';
          }
          break;
        case 'CODE':
          if (element.parentElement?.tagName.toUpperCase() !== 'PRE') {
            startTag = '`'; endTag = '`';
          }
          break;
        case 'PRE':
          const codeElement = element.querySelector('code');
          const lang = codeElement?.className?.replace('language-', '') || '';
          startTag = `\`\`\`${lang}\n`;
          endTag = '\n```';
          break;
        case 'BLOCKQUOTE':
          startTag = '> '; break;
        case 'A':
          startTag = '[';
          const href = element.getAttribute('href') || '';
          endTag = `](${href})`;
          break;
        case 'BR':
          startTag = '\n'; break;
      }

      markdownOffset += startTag.length;

      for (let i = 0; i < node.childNodes.length; i++) {
        if (node === targetNode && i === targetOffset) {
          found = true;
          return;
        }

        traverse(node.childNodes[i]);
        if (found) return;
      }

      if (node === targetNode && targetOffset >= node.childNodes.length) {
        found = true;
        return;
      }

      markdownOffset += endTag.length;
    }
  }

  traverse(root);
  return markdownOffset;
}

// Select a text range inside the contenteditable element based on Markdown string offsets (start and end)
function setSelectionRangeFromMarkdown(root: HTMLElement, startOffset: number, endOffset: number) {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  let currentMarkdownOffset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  function traverse(node: Node) {
    if (startNode && endNode) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textLen = node.nodeValue?.length || 0;
      
      // Locate the DOM node and local offset for the start of selection
      if (!startNode && currentMarkdownOffset + textLen >= startOffset) {
        startNode = node;
        startNodeOffset = startOffset - currentMarkdownOffset;
      }
      
      // Locate the DOM node and local offset for the end of selection
      if (!endNode && currentMarkdownOffset + textLen >= endOffset) {
        endNode = node;
        endNodeOffset = endOffset - currentMarkdownOffset;
      }
      
      currentMarkdownOffset += textLen;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toUpperCase();

      let startTag = '';
      let endTag = '';
      switch (tagName) {
        case 'STRONG':
        case 'B':
          startTag = '**'; endTag = '**'; break;
        case 'EM':
        case 'I':
          startTag = '_'; endTag = '_'; break;
        case 'U':
          startTag = '__'; endTag = '__'; break;
        case 'DEL':
        case 'STRIKE':
          startTag = '~~'; endTag = '~~'; break;
        case 'SPAN':
          if (element.classList.contains('spoiler')) {
            startTag = '||'; endTag = '||';
          }
          break;
        case 'CODE':
          if (element.parentElement?.tagName.toUpperCase() !== 'PRE') {
            startTag = '`'; endTag = '`';
          }
          break;
        case 'PRE':
          const codeElement = element.querySelector('code');
          const lang = codeElement?.className?.replace('language-', '') || '';
          startTag = `\`\`\`${lang}\n`;
          endTag = '\n```';
          break;
        case 'BLOCKQUOTE':
          startTag = '> '; break;
        case 'A':
          startTag = '[';
          const href = element.getAttribute('href') || '';
          endTag = `](${href})`;
          break;
        case 'BR':
          startTag = '\n'; break;
      }

      currentMarkdownOffset += startTag.length;

      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (startNode && endNode) return;
      }

      currentMarkdownOffset += endTag.length;
    }
  }

  traverse(root);

  // Fallbacks if target offsets exceed node lengths
  if (!startNode) {
    startNode = root;
    startNodeOffset = root.childNodes.length;
  }
  if (!endNode) {
    endNode = root;
    endNodeOffset = root.childNodes.length;
  }

  try {
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
  } catch (e) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

// Check which formatting tags are active at the user caret position and highlight formatting toolbar buttons
export function updateToolbarActiveStates(input: HTMLElement): void {
  const toolbar = document.querySelector('.chat-formatting-toolbar');
  if (!toolbar) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    toolbar.querySelectorAll('.chat-format-btn').forEach(btn => btn.classList.remove('active'));
    return;
  }

  const range = sel.getRangeAt(0);
  const activeFormats = new Set<string>();

  const checkNode = (startNode: Node | null, offset: number, isStart: boolean) => {
    let node = startNode;
    if (node === input && input.childNodes.length > 0) {
      node = input.childNodes[offset] || input.childNodes[input.childNodes.length - 1] || input;
    }

    if (node) {
      if (isStart) {
        while (node.hasChildNodes()) {
          node = node.firstChild!;
        }
      } else {
        while (node.hasChildNodes()) {
          node = node.lastChild!;
        }
      }
    }

    while (node && node !== input) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toUpperCase();

        if (tag === 'STRONG' || tag === 'B') activeFormats.add('bold');
        if (tag === 'EM' || tag === 'I') activeFormats.add('italic');
        if (tag === 'U') activeFormats.add('underline');
        if (tag === 'DEL' || tag === 'STRIKE') activeFormats.add('strike');
        if (tag === 'CODE') activeFormats.add('mono');
        if (el.classList.contains('spoiler')) activeFormats.add('spoiler');
        if (tag === 'BLOCKQUOTE') activeFormats.add('quote');
        if (tag === 'A') activeFormats.add('link');
      }
      node = node.parentNode;
    }
  };

  checkNode(range.startContainer, range.startOffset, true);
  checkNode(range.endContainer, range.endOffset, false);

  // Update active state class on toolbar buttons
  toolbar.querySelectorAll('.chat-format-btn').forEach(buttonEl => {
    const format = buttonEl.getAttribute('data-format');
    if (format && activeFormats.has(format)) {
      buttonEl.classList.add('active');
    } else {
      buttonEl.classList.remove('active');
    }
  });
}

export function syncChatRichInputMirror(input: any): void {
  const field = input.closest('.chat-input-field');
  const text = input.innerText || '';
  field?.classList.toggle('is-empty', !text.trim());
}

export function adjustChatInputHeight(_input: any, _maxHeight = 150): void {
  // contenteditable div handles dynamic height automatically
}

export function bindChatRichInput(input: any): void {
  if (input.dataset.richInputBound === '1') return;
  input.dataset.richInputBound = '1';
  input.classList.add('chat-input--rich');

  const updateEmptyState = () => {
    const field = input.closest('.chat-input-field');
    const text = input.innerText || '';
    field?.classList.toggle('is-empty', !text.trim());
  };

  input.addEventListener('input', updateEmptyState);

  // Sync toolbar active states on user action/selection events
  const updateStates = () => updateToolbarActiveStates(input);
  input.addEventListener('keyup', updateStates);
  input.addEventListener('mouseup', updateStates);
  input.addEventListener('focus', updateStates);
  document.addEventListener('selectionchange', updateStates);

  // Implement getters/setters mapping input properties directly to markdown translations
  Object.defineProperty(input, 'value', {
    get() {
      return htmlToMarkdown(input.innerHTML);
    },
    set(val) {
      const html = parseFormattedChatText(val || '');
      if (input.innerHTML !== html) {
        input.innerHTML = html;
      }
      updateEmptyState();
      setTimeout(updateStates, 10);
    },
    configurable: true
  });

  Object.defineProperty(input, 'selectionStart', {
    get() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return 0;
      const range = sel.getRangeAt(0);
      return getMarkdownOffset(input, range.startContainer, range.startOffset);
    },
    set(val) {
      setSelectionRangeFromMarkdown(input, val, input.selectionEnd);
    },
    configurable: true
  });

  Object.defineProperty(input, 'selectionEnd', {
    get() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return 0;
      const range = sel.getRangeAt(0);
      return getMarkdownOffset(input, range.endContainer, range.endOffset);
    },
    set(val) {
      setSelectionRangeFromMarkdown(input, input.selectionStart, val);
    },
    configurable: true
  });

  input.setSelectionRange = function(start: number, end: number) {
    setSelectionRangeFromMarkdown(input, start, end);
  };

  input.addEventListener('beforeinput', (e: InputEvent) => {
    const max = parseInt(input.dataset.maxlength || '2000');
    const currentLen = (input.innerText || '').length;
    if (currentLen >= max && e.inputType !== 'deleteContentBackward' && e.inputType !== 'deleteContentForward') {
      e.preventDefault();
    }
  });

  updateEmptyState();
}

export function handleChatInputFormatShortcut(event: KeyboardEvent, input: any): boolean {
  if (!(event.ctrlKey || event.metaKey)) return false;

  const key = event.key.toLowerCase();
  let handled = false;

  if (event.shiftKey) {
    switch (key) {
      case 'x': // Strikethrough
        handled = true;
        insertChatFormatting('~~', '~~', input);
        break;
      case 'm': // Monospace
        handled = true;
        insertChatFormatting('`', '`', input);
        break;
      case 'p': // Spoiler
        handled = true;
        insertChatFormatting('||', '||', input);
        break;
      case 'q': // Quote
        handled = true;
        insertChatBlockquote(input);
        break;
      case 'c': // Code block
        handled = true;
        void insertChatCode(input);
        break;
    }
  } else {
    switch (key) {
      case 'b': // Bold
        handled = true;
        insertChatFormatting('**', '**', input);
        break;
      case 'i': // Italic
        handled = true;
        insertChatFormatting('_', '_', input);
        break;
      case 'u': // Underline
        handled = true;
        insertChatFormatting('__', '__', input);
        break;
      case 'k': // Link
        handled = true;
        void insertChatLink(input);
        break;
    }
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
  return handled;
}
