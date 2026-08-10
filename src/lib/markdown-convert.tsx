import React from "react";

const listRegex = /^(\d+\.|-) /;

enum ParseState {
    UL = 'UL',
    OL = 'OL',
    P = 'P'
}

const inlineLinkRegex = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s]+)/g;

function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const regex = new RegExp(inlineLinkRegex);
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }

        if (match[1] !== undefined) {
            nodes.push(<a key={`${keyPrefix}-link-${idx++}`} href={match[2]}>{match[1]}</a>);
        } else {
            let url = match[3];
            const trailing = url.match(/[.,;:!?)]+$/)?.[0] ?? '';
            url = url.slice(0, url.length - trailing.length);

            nodes.push(<a key={`${keyPrefix}-link-${idx++}`} href={url}>{url.replace(/^https?:\/\//, '')}</a>);
            if (trailing) nodes.push(trailing);
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes;
}

function renderHeader(line: string, key: string) {
    const match = line.match(/^(#{1,6}) (.*)$/);
    if (!match) return <p key={key}>{parseInline(line, key)}</p>;

    const level = match[1].length;
    const text = match[2];
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;

    return <Tag key={key}>{parseInline(text, key)}</Tag>;
}

function flush(state: ParseState | null, curr: React.ReactNode[], key: string): React.ReactNode | null {
    if (curr.length === 0 || !state) return null;

    if (state === ParseState.UL) {
        return <ul key={key}>{curr}</ul>;
    }
    if (state === ParseState.OL) {
        return <ol key={key}>{curr}</ol>;
    }
    if (state === ParseState.P) {
        const nodes: React.ReactNode[] = [];
        curr.forEach((line, idx) => {
            if (idx > 0) nodes.push(' ');
            nodes.push(...parseInline(line as string, `${key}-p-${idx}`));
        });
        return <p key={key}>{nodes}</p>;
    }
    return null;
}

export function markdownToHtml(content: string) {
    const results: React.ReactNode[] = [];
    let curr: React.ReactNode[] = [];
    let state: ParseState | null = null;
    
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const blockKey = `block-${i}`;

        if (line.length === 0) {
            const flushed = flush(state, curr, blockKey);
            if (flushed) results.push(flushed);
            curr = [];
            state = null;
            continue;
        }

        if (line.startsWith('#')) {
            const flushed = flush(state, curr, `flush-${blockKey}`);
            if (flushed) results.push(flushed);
            curr = [];
            state = null;

            results.push(renderHeader(line, blockKey));
            continue;
        }

        const listMatch = line.match(listRegex);
        if (listMatch) {
            const isOrderded = /^\d/.test(listMatch[0]);
            const nextState = isOrderded ? ParseState.OL : ParseState.UL;

            if (state && state !== nextState) {
                const flushed = flush(state, curr, `flush-${blockKey}`);
                if (flushed) results.push(flushed);
                curr = [];
            }

            state = nextState;
            const contentText = line.slice(listMatch[0].length);
            curr.push(<li key={`li-${i}`}>{parseInline(contentText, `li-${i}`)}</li>);
            continue;
        }

        if (state && state !== ParseState.P) {
            const flushed = flush(state, curr, `flush-${blockKey}`);
            if (flushed) results.push(flushed);
            curr = [];
        }
        
        state = ParseState.P;
        curr.push(line);
    }

    const finalFlushed = flush(state, curr, 'flush-final');
    if (finalFlushed) {
        results.push(finalFlushed);
    }

    return (
        <div>
            {results}
        </div>
    );
}