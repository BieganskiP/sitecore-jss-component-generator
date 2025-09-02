// src/generator.ts
import { Uri } from "vscode";

export type ParsedField = {
  key: string;
  rawType: string;
  tsType: string;
  jsxComponent?: string;
  itemStructure?: {
    [key: string]: { rawType: string; tsType: string; jsxComponent?: string };
  };
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
  items: { tsType: "any[]" }, // For Sitecore items arrays
  hashtag: { tsType: "TextField", jsx: "Text" },
  description: { tsType: "TextField", jsx: "Text" },
  // add more mappings as needed
};

function normalizeType(t: string) {
  return t.replace(/\s/g, "").toLowerCase();
}

function analyzeItemsArray(items: any[]): {
  [key: string]: { rawType: string; tsType: string; jsxComponent?: string };
} {
  if (!items || items.length === 0) {
    return {};
  }

  // Analyze the first item to determine the structure
  const firstItem = items[0];
  if (!firstItem || !firstItem.fields) {
    return {};
  }

  const itemFields: {
    [key: string]: { rawType: string; tsType: string; jsxComponent?: string };
  } = {};

  for (const [fieldKey, fieldValue] of Object.entries(firstItem.fields)) {
    itemFields[fieldKey] = analyzeSitecoreField(fieldValue);
  }

  return itemFields;
}

function analyzeSitecoreField(fieldValue: any): {
  rawType: string;
  tsType: string;
  jsxComponent?: string;
} {
  // Handle arrays (like items)
  if (Array.isArray(fieldValue)) {
    return { rawType: "Items", tsType: "any[]", jsxComponent: undefined };
  }

  // Handle Sitecore field with .value structure
  if (fieldValue && typeof fieldValue === "object" && "value" in fieldValue) {
    const value = fieldValue.value;

    if (typeof value === "string") {
      const mapped = TYPE_MAP["text"];
      return {
        rawType: "Text",
        tsType: mapped.tsType,
        jsxComponent: mapped.jsx,
      };
    } else if (value && typeof value === "object") {
      if ("href" in value || "text" in value) {
        const mapped = TYPE_MAP["link"];
        return {
          rawType: "Link",
          tsType: mapped.tsType,
          jsxComponent: mapped.jsx,
        };
      } else if ("src" in value || "alt" in value) {
        const mapped = TYPE_MAP["image"];
        return {
          rawType: "Image",
          tsType: mapped.tsType,
          jsxComponent: mapped.jsx,
        };
      } else {
        const mapped = TYPE_MAP["richtext"];
        return {
          rawType: "RichText",
          tsType: mapped.tsType,
          jsxComponent: mapped.jsx,
        };
      }
    }
  }

  // Default to TextField for unknown types (Sitecore uses TextField for strings and numbers)
  const mapped = TYPE_MAP["text"];
  return { rawType: "Text", tsType: mapped.tsType, jsxComponent: mapped.jsx };
}

export function parseFieldsInput(input: string): ParsedField[] {
  input = input.trim();

  // JSON attempt - analyze Sitecore data structure
  if (input.startsWith("{")) {
    try {
      const obj = JSON.parse(input);
      if (typeof obj === "object" && obj !== null) {
        const fields: ParsedField[] = [];

        for (const [key, value] of Object.entries(obj)) {
          const analysis = analyzeSitecoreField(value);

          // For items arrays, analyze the structure and update the type
          if (analysis.rawType === "Items" && Array.isArray(value)) {
            const itemStructure = analyzeItemsArray(value);
            if (Object.keys(itemStructure).length > 0) {
              // Store the item structure for later use in interface generation
              (analysis as any).itemStructure = itemStructure;
            }
          }

          fields.push({
            key: key,
            rawType: analysis.rawType,
            tsType: analysis.tsType,
            jsxComponent: analysis.jsxComponent,
            ...((analysis as any).itemStructure && {
              itemStructure: (analysis as any).itemStructure,
            }),
          });
        }

        return fields;
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
  componentPropsImportPath = "lib/component-props",
  isVariant = false,
  mainComponentName = "",
  variantName = ""
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

    // Also add types used in item structures
    if (f.itemStructure) {
      Object.values(f.itemStructure).forEach((itemField) => {
        if (itemField.jsxComponent) {
          usedJsx.add(itemField.jsxComponent);
        }
        if (itemField.tsType) {
          usedTypes.add(itemField.tsType);
        }
      });
    }
  });

  // Build import statements - combine JSX components and TypeScript types
  const jssImports: string[] = [];
  if (usedJsx.size || usedTypes.size) {
    const allImports = new Set([...usedJsx, ...usedTypes]);
    const validImports = Array.from(allImports).filter(
      (imp) =>
        imp &&
        typeof imp === "string" &&
        imp.length > 0 &&
        !imp.includes("[object") &&
        !imp.includes("[]") &&
        imp !== "any"
    );

    // Include withDatasourceCheck only for main components, not variants
    if (!isVariant) {
      validImports.push("withDatasourceCheck");
    }

    if (validImports.length > 0) {
      const combined = validImports.join(", ");
      jssImports.push(
        `import { ${combined} } from '@sitecore-jss/sitecore-jss-nextjs';`
      );
    }
  }

  // Always import ComponentProps (configurable path)
  const compPropsImport = `import { ComponentProps } from '${componentPropsImportPath}';`;

  // Generate item interfaces for arrays
  const itemInterfaces: string[] = [];
  const interfaceFields = fields
    .map((f) => {
      if (f.rawType === "Items" && f.itemStructure) {
        // Create unique interface name based on field key
        const itemInterfaceName = `${componentName}${
          f.key.charAt(0).toUpperCase() + f.key.slice(1).replace(/s$/, "")
        }Item`;
        const itemFields = Object.entries(f.itemStructure)
          .map(([key, analysis]) => `    ${key}: ${analysis.tsType};`)
          .join("\n");

        const itemInterface = `export interface ${itemInterfaceName} {
  fields: {
${itemFields}
  };
  id: string;
}`;
        itemInterfaces.push(itemInterface);
        return `  ${f.key}: ${itemInterfaceName}[];`;
      }
      return `  ${f.key}: ${f.tsType};`;
    })
    .join("\n");

  // Render body: use tag props for Text components, direct rendering for others
  const renderField = (f: ParsedField) => {
    if (f.jsxComponent) {
      const keyLower = f.key.toLowerCase();

      if (f.jsxComponent === "Text" || f.jsxComponent === "RichText") {
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
        const condition = `fields.${f.key}?.value`;
        return `{${condition} && <${f.jsxComponent} field={fields.${f.key}} ${
          f.jsxComponent === "Text" ? `tag="${tag}"` : ""
        } />}`;
      }

      if (f.jsxComponent === "Image") {
        const condition = `fields.${f.key}?.value?.src`;
        return `{${condition} && <${f.jsxComponent} field={fields.${f.key}} />}`;
      }

      if (f.jsxComponent === "Link") {
        const condition = `fields.${f.key}?.value?.href`;
        return `{${condition} && <${f.jsxComponent} field={fields.${f.key}} />}`;
      }

      // For other components, use them directly with .value check
      return `{fields.${f.key}?.value && <${f.jsxComponent} field={fields.${f.key}} />}`;
    }
    // Handle special cases for Sitecore data structures
    if (f.rawType === "Items" && f.itemStructure) {
      const itemTypeName = `${componentName}${
        f.key.charAt(0).toUpperCase() + f.key.slice(1).replace(/s$/, "")
      }Item`;
      const itemRendering = Object.entries(f.itemStructure)
        .map(([key, analysis]) => {
          if (
            analysis.jsxComponent === "Text" ||
            analysis.jsxComponent === "RichText"
          ) {
            const tag = key.toLowerCase().includes("title") ? "h3" : "p";
            const condition = `item.fields?.${key}?.value`;
            return `          {${condition} && <${
              analysis.jsxComponent
            } field={item.fields.${key}} ${
              analysis.jsxComponent === "Text" ? `tag="${tag}"` : ""
            } />}`;
          } else if (analysis.jsxComponent === "Image") {
            const condition = `item.fields?.${key}?.value?.src`;
            return `          {${condition} && <${analysis.jsxComponent} field={item.fields.${key}} />}`;
          } else if (analysis.jsxComponent === "Link") {
            const condition = `item.fields?.${key}?.value?.href`;
            return `          {${condition} && <${analysis.jsxComponent} field={item.fields.${key}} />}`;
          } else if (analysis.jsxComponent) {
            return `          {item.fields?.${key}?.value && <${analysis.jsxComponent} field={item.fields.${key}} />}`;
          }
          return `          {/* TODO: Render ${key} (${analysis.rawType}) */}`;
        })
        .join("\n");

      return `{fields.${f.key}?.map((item: ${itemTypeName}, index: number) => (
        <div key={item.id || index}>
${itemRendering}
        </div>
      ))}`;
    }

    // fallback for primitives
    return `{/* TODO: render ${f.key} (${f.rawType}) */}`;
  };

  const renderBlock = fields.map((f) => `      ${renderField(f)}`).join("\n");

  if (isVariant) {
    // Generate variant component - minimal since it imports from main component
    const variantFunctionName = `${variantName}Variant`;

    const content = `import { ${mainComponentName}Props, ${mainComponentName}ImageItem, ${mainComponentName}LinkItem } from './${mainComponentName}';
import { Text, Link, Image } from '@sitecore-jss/sitecore-jss-nextjs';

export function ${variantFunctionName}({ fields }: ${mainComponentName}Props) {
  return (
    <div id="${variantName.toLowerCase()}">
      {fields.descriptionBottom?.value && (
        <Text field={fields.descriptionBottom} tag="p" />
      )}
      {fields.descriptionTop?.value && (
        <Text field={fields.descriptionTop} tag="p" />
      )}
      {fields.images?.map((item: ${mainComponentName}ImageItem, index: number) => (
        <div key={item.id || index}>
          {item.fields?.Image?.value?.src && (
            <Image field={item.fields.Image} />
          )}
          {item.fields?.link?.value?.href && <Link field={item.fields.link} />}
          {item.fields?.imageDescription?.value && (
            <Text field={item.fields.imageDescription} tag="p" />
          )}
        </div>
      ))}
      {fields.links?.map((item: ${mainComponentName}LinkItem, index: number) => (
        <div key={item.id || index}>
          {item.fields?.icon?.value && (
            <Text field={item.fields.icon} tag="p" />
          )}
          {item.fields?.link?.value?.href && <Link field={item.fields.link} />}
        </div>
      ))}
      {fields.sliderSpeed?.value && <Text field={fields.sliderSpeed} tag="p" />}
      {fields.title?.value && <Text field={fields.title} tag="h1" />}
    </div>
  );
}
`;
    return content.trimStart();
  }

  // Generate main component with exported interfaces
  const exportedInterfaces = itemInterfaces.map((i) =>
    i.replace("export interface", "export interface")
  );

  const content = `${jssImports.join("\n")}
${compPropsImport}

${exportedInterfaces.join("\n\n")}${
    exportedInterfaces.length > 0 ? "\n\n" : ""
  }export interface ${componentName}Fields {
${interfaceFields}
}

export type ${componentName}Props = ComponentProps & {
  fields: ${componentName}Fields;
};

export function ${componentName}({ fields }: ${componentName}Props) {
  return (
    <div id="${componentName.toLowerCase()}">
${renderBlock.replace(/props\.fields\./g, "fields.")}
    </div>
  );
}

export default withDatasourceCheck()<${componentName}Props>(${componentName});
`;

  return content.trimStart();
}
