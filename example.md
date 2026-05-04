# Examples

---

## Replace Nested Branch Expressions

Before:

```ts
type === `info` && (() => {
  console.info(logMsg);
  appendOutput(`info`, outputMsg, activeLevel);
})();
```

After:

```ts
switch (type) {
  case `info`:
    console.info(logMsg);
    appendOutput(`info`, outputMsg, activeLevel);
    break;
}
```

---

## Return Configuration From The Real Boundary

Before:

```ts
fs.existsSync(configPath) && (() => {
  const configContent = fs.readFileSync(configPath, `utf8`);
  return JSON.parse(configContent);
})();
return DEFAULT_JSHINT_CONFIG;
```

After:

```ts
if (!fs.existsSync(configPath)) {
  continue;
}
const configContent = fs.readFileSync(configPath, `utf8`);
return JSON.parse(configContent);
```

---

## Keep Save Validation Cheap

Before:

```ts
const allStyles = await support.getStyles(doc);
const usage = scanDocumentUsages(fullText, doc, knownClasses, knownIds);
```

After:

```ts
let allStyles = await support.getStyles(doc, { fullText, includeWorkspace: false });
let usage = scanDocumentUsages(fullText, doc, knownClasses, knownIds);

if (usage.diagnostics.length > 0) {
  allStyles = await support.getStyles(doc, { fullText, includeWorkspace: true });
  usage = scanDocumentUsages(fullText, doc, knownClasses, knownIds);
}
```
