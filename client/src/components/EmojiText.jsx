import React, { useState } from 'react';

// Renders emojis as Google "Noto 3D" images instead of the device's own emoji font,
// so every phone (and the server recorder) shows exactly the same emoji design.
// Images are served by our own server from /emoji/3d/<file> (cached copy of googlefonts/noto-emoji, 3D/png/128).

// One emoji "cluster": flags, keycaps, and pictographs incl. skin tones / ZWJ sequences
const EMOJI_RE = /\p{RI}\p{RI}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:️|\p{EMod})?(?:‍\p{Extended_Pictographic}(?:️|\p{EMod})?)*/gu;

// ©, ® and ™ are only emojis when explicitly requested with U+FE0F
const TEXT_DEFAULT = new Set([0xa9, 0xae, 0x2122]);

export function emojiFile(cluster) {
    const cps = [...cluster].map(c => c.codePointAt(0)).filter(cp => cp !== 0xfe0f);
    return `emoji_u${cps.map(cp => cp.toString(16).padStart(4, '0')).join('_')}.png`;
}

export const emojiUrl = (cluster) => `/emoji/3d/${emojiFile(cluster)}`;

function EmojiImg({ char }) {
    const [failed, setFailed] = useState(false);
    if (failed) return <span>{char}</span>; // no image for this emoji -> device emoji
    return (
        <img
            src={emojiUrl(char)}
            alt={char}
            draggable={false}
            onError={() => setFailed(true)}
            style={{
                width: '1.25em',
                height: '1.25em',
                verticalAlign: '-0.3em',
                margin: '0 0.04em',
                objectFit: 'contain',
                display: 'inline-block',
                pointerEvents: 'none'
            }}
        />
    );
}

export default function EmojiText({ text }) {
    if (typeof text !== 'string' || !text) return text ?? null;
    const parts = [];
    let last = 0;
    let key = 0;
    for (const m of text.matchAll(EMOJI_RE)) {
        const char = m[0];
        if (char.length === 1 && TEXT_DEFAULT.has(char.codePointAt(0))) continue;
        if (m.index > last) parts.push(text.slice(last, m.index));
        parts.push(<EmojiImg key={key++} char={char} />);
        last = m.index + char.length;
    }
    if (!parts.length) return text;
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
}
