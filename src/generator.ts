// src/generator.ts
import { Uri } from "vscode";

export type ParsedField = {
  key: string;
  rawType: string;
  tsType: string;
  jsxComponent?: string;
};

const TYPE_MAP: Record<string, { tsType: string; jsx?: string }> = {
  text: { tsType: "TextField", jsx: "Text" },
  textfield: { tsType: "TextField", jsx: "Text" },
  richtext: { tsType: "RichTextField", jsx: "RichText" },
  richtextfield: { tsType: "RichTextField", jsx: "RichText" },
  image: { tsType: "ImageField", jsx: "Image" },
  imagefield: { tsType: "ImageField", jsx: "Image" },
  link: { tsType: "LinkField", jsx: "Link" },
  linkfield: { tsType: "LinkField", jsx: "Link" },
  // add more mappings (checkbox, date) if you wish
};

function normalizeType(t: string) {
  return t.replace(/\s/g, "").toLowerCase();
}

export function parseFieldsInput(input: string): ParsedField[] {
  input = input.trim();
  // JSON attempt
  if (input.startsWith("{")) {
    try {
      const obj = JSON.parse(input);
      if (typeof obj === "object" && obj !== null) {
        return Object.entries(obj).map(([k, v]) => {
          const rawType = typeof v === "string" ? v : String(v);
          const mapped = TYPE_MAP[normalizeType(rawType)];
          return {
            key: String(k),
            rawType,
            tsType: mapped ? mapped.tsType : rawType || "any",
            jsxComponent: mapped && mapped.jsx ? mapped.jsx : undefined,
          };
        });
      }
    } catch (e) {
      // fallthrough to simple parser
    }
  }

  // simple "name:Type, name2:Type2" format
  const pairs = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fields: ParsedField[] = [];
  for (const p of pairs) {
    const [rawKey, rawType = "any"] = p.split(":").map((s) => s.trim());
    const mapped = TYPE_MAP[normalizeType(rawType)];
    fields.push({
      key: rawKey,
      rawType,
      tsType: mapped ? mapped.tsType : rawType || "any",
      jsxComponent: mapped && mapped.jsx ? mapped.jsx : undefined,
    });
  }
  return fields;
}

export function generateComponentSource(
  componentName: string,
  fields: ParsedField[],
  componentPropsImportPath = "lib/component-props"
): string {
  const usedJsx = new Set<string>();
  const usedTypes = new Set<string>();

  fields.forEach((f) => {
    if (f.jsxComponent) {
      usedJsx.add(f.jsxComponent);
    }
    if (f.tsType) {
      usedTypes.add(f.tsType);
    }
  });

  // Build import statements - combine JSX components and TypeScript types
  const jssImports: string[] = [];
  if (usedJsx.size || usedTypes.size) {
    const combined = [...usedJsx, ...usedTypes].join(", ");
    jssImports.push(
      `import { ${combined} } from '@sitecore-jss/sitecore-jss-nextjs';`
    );
  }

  // Always import ComponentProps (configurable path)
  const compPropsImport = `import { ComponentProps } from '${componentPropsImportPath}';`;

  // Interface fields
  const interfaceFields = fields
    .map((f) => `  ${f.key}: ${f.tsType};`)
    .join("\n");

  // Render body: use tag props for Text components, direct rendering for others
  const renderField = (f: ParsedField) => {
    if (f.jsxComponent) {
      const keyLower = f.key.toLowerCase();

      if (f.jsxComponent === "Text") {
        // Use tag prop for Text components based on field name
        let tag = "p"; // default tag
        if (keyLower.includes("title")) {
          tag = "h1";
        } else if (
          keyLower.includes("subtitle") ||
          keyLower.includes("heading")
        ) {
          tag = "h2";
        }
        return `<${f.jsxComponent} field={props.fields.${f.key}} tag="${tag}" />`;
      }

      // For other components (Image, Link, RichText), use them directly
      return `<${f.jsxComponent} field={props.fields.${f.key}} />`;
    }
    // fallback for primitives
    return `{/* TODO: render ${f.key} (${f.rawType}) */}`;
  };

  const renderBlock = fields.map((f) => `      ${renderField(f)}`).join("\n");

  const content = `import React from 'react';
${jssImports.join("\n")}
${compPropsImport}

interface ${componentName}Fields {
${interfaceFields}
}

export type ${componentName}Props = ComponentProps & {
  fields: ${componentName}Fields;
};

const ${componentName} = (props: ${componentName}Props): JSX.Element => {
  return (
    <div className="${componentName.toLowerCase()}">
${renderBlock}
    </div>
  );
};

export default ${componentName};
`;

  return content.trimStart();
}
