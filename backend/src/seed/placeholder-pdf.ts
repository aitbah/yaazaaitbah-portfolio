/**
 * Draws a placeholder PDF in memory, without a PDF library: one page in a
 * standard font needs no embedded font data. It says on the page that it is a
 * placeholder.
 */

/**
 * The typographic characters this project's prose actually uses, at the code
 * points WinAnsi gives them.
 *
 * The standard fourteen fonts carry these glyphs; what differs is which byte
 * asks for them. Without the mapping an em dash is silently dropped on the way
 * through `latin1` and the sentence closes up around the hole.
 */
const WIN_ANSI: Record<string, string> = {
  '\u2014': '\u0097', // -
  '\u2013': '\u0096', // –
  '\u2018': '\u0091', // '
  '\u2019': '\u0092', // '
  '\u201c': '\u0093', // "
  '\u201d': '\u0094', // "
  '\u2026': '\u0085', // …
  '\u00a0': ' ',
  '\u202f': ' ',
};

/**
 * A PDF literal string: the syntax's own punctuation escaped, the typographic
 * characters remapped, and anything still outside the single-byte range
 * replaced rather than dropped.
 *
 * Replaced and not dropped on purpose - a visible `?` in a placeholder is a
 * question someone can answer, and a character that silently vanishes is not.
 */
function escapeText(value: string): string {
  return [...value]
    .map((character) => WIN_ANSI[character] ?? character)
    .map((character) => (character.codePointAt(0)! > 0xff ? '?' : character))
    .join('')
    .replace(/([\\()])/g, '\\$1');
}

export function placeholderPdf(lines: readonly string[]): Buffer {
  const [title = '', ...rest] = lines;

  // 24pt for the heading, 12pt for the rest, starting a third of the way down
  // an A4 page. `TL`/`T*` set the leading once and step by it, so the body
  // stays evenly spaced however many lines are passed.
  const content = [
    'BT',
    '/F1 24 Tf',
    '72 720 Td',
    `(${escapeText(title)}) Tj`,
    '/F2 12 Tf',
    '18 TL',
    '0 -36 Td',
    ...rest.map((line) => `(${escapeText(line)}) Tj T*`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  const header = '%PDF-1.4\n';
  // Byte offsets, not character ones: the xref table is wrong by however many
  // multi-byte characters precede it otherwise, and a reader that checks will
  // refuse the file.
  const offsets: number[] = [];
  let body = '';

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(header + body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const startXref = Buffer.byteLength(header + body, 'latin1');

  // Every entry is exactly 20 bytes, including the trailing space - the format
  // is fixed-width and a reader seeks into it by multiplication.
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(startXref),
    '%%EOF\n',
  ].join('\n');

  return Buffer.from(header + body + xref, 'latin1');
}
