import {parseSelectors} from '../out/langs/css/cssParser.js';

const samples = [
    '.foo { color: red; }',
    '#bar, .baz:hover { background: blue; }',
    'div .a, span#b { display: block; }',
    '/* comment */ .c { }',
    '.escaped\\:name { } .d\\,e { }',
    '@media (max-width: 600px) { .responsive { } }'
];

for (const s of samples) {
    const parsed = parseSelectors(s);
    console.log('CSS:', s);
    console.log(JSON.stringify(parsed, null, 2));
}
