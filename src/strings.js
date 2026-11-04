import en from "./locales/en.js";

const LOCALES = Object.freeze({ en });

// Returns t(key, values). A missing key or value throws, so gaps show up in
// tests rather than as stray key names on screen.
export function translator(locale) {
  const table = Object.hasOwn(LOCALES, locale) ? LOCALES[locale] : null;
  if (!table) throw new Error(`Unknown locale: ${locale}`);

  return (key, values = {}) => {
    const text = key.split(".").reduce((node, part) => (node !== null && typeof node === "object" && Object.hasOwn(node, part) ? node[part] : undefined), table);
    if (typeof text !== "string") throw new Error(`Missing translation: ${locale}.${key}`);
    return text.replace(/%\{(\w+)\}/g, (_, name) => {
      const value = values[name];
      if (value === undefined) throw new Error(`Missing value "${name}" for ${locale}.${key}`);
      return String(value);
    });
  };
}
