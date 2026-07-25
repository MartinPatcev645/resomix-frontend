import type { CodeLine, CodeToken } from './devEngine.ts';

function tokenClass(type: CodeToken['type']) {
  if (type === 'k') return 'dev-k';
  if (type === 's') return 'dev-s';
  if (type === 'o') return 'dev-o';
  if (type === 'c') return 'dev-c';
  return '';
}

export function DevCodeBlock({ lines, id }: { lines: CodeLine[]; id?: string }) {
  return (
    <code id={id}>
      {lines.map((line, li) => (
        <span key={li}>
          {line.map((tok, ti) => (
            <span key={ti} className={tokenClass(tok.type)}>
              {tok.text}
            </span>
          ))}
          {li < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </code>
  );
}

