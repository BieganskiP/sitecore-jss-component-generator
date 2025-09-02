// src/extension.ts
import * as vscode from "vscode";
import { parseFieldsInput, generateComponentSource } from "./generator";
import { pascalCase } from "./utils";

function addVariantToMainComponent(
  mainComponentContent: string,
  variantName: string
): string {
  let updatedContent = mainComponentContent;

  // Check what JSX components are being used but not imported
  const usedComponents = new Set<string>();
  const usedTypes = new Set<string>();

  // Find JSX components being used
  const jsxMatches = updatedContent.match(/<(Text|Link|Image|RichText)\s/g);
  if (jsxMatches) {
    jsxMatches.forEach((match) => {
      const component = match.replace(/<|\\s/g, "");
      usedComponents.add(component);
    });
  }

  // Find TypeScript types being used
  const typeMatches = updatedContent.match(
    /(TextField|LinkField|ImageField|RichTextField)/g
  );
  if (typeMatches) {
    typeMatches.forEach((type) => usedTypes.add(type));
  }

  // Check what's already imported from sitecore-jss-nextjs
  const sitecoreImportMatch = updatedContent.match(
    /import\s*{([^}]+)}\s*from\s*['"]@sitecore-jss\/sitecore-jss-nextjs['"];?/
  );
  const currentImports = new Set<string>();
  if (sitecoreImportMatch) {
    const imports = sitecoreImportMatch[1].split(",").map((imp) => imp.trim());
    imports.forEach((imp) => currentImports.add(imp));
  }

  // Find missing imports
  const allNeeded = new Set([...usedComponents, ...usedTypes]);
  const missingImports = Array.from(allNeeded).filter(
    (imp) => !currentImports.has(imp)
  );

  // Update the sitecore import if there are missing imports
  if (missingImports.length > 0 && sitecoreImportMatch) {
    const allImports = Array.from(
      new Set([...currentImports, ...missingImports])
    );
    const newImportStatement = `import { ${allImports.join(
      ", "
    )} } from '@sitecore-jss/sitecore-jss-nextjs';`;
    updatedContent = updatedContent.replace(
      sitecoreImportMatch[0],
      newImportStatement
    );
  }

  // Add import for the variant at the top (after existing imports)
  const importStatement = `import { ${variantName}Variant } from "./${variantName}Variant";`;

  // Find the last import statement
  const importRegex = /^import\s+.*?from\s+['"].*?['"];?\s*$/gm;
  let lastImportMatch;
  let match;

  while ((match = importRegex.exec(updatedContent)) !== null) {
    lastImportMatch = match;
  }

  if (lastImportMatch) {
    const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
    updatedContent =
      updatedContent.slice(0, insertPosition) +
      "\n" +
      importStatement +
      updatedContent.slice(insertPosition);
  }

  // Add the variant export function before the default export
  const defaultExportRegex =
    /export default withDatasourceCheck\(\)<.*?>\(.*?\);/;
  const variantFunction = `
function ${variantName}({ fields }: ${
    mainComponentContent.match(/export type (\w+)Props/)?.[1] || "Component"
  }Props) {
  return <${variantName}Variant fields={fields} />;
}

export const ${variantName} = withDatasourceCheck()<${
    mainComponentContent.match(/export type (\w+)Props/)?.[1] || "Component"
  }Props>(${variantName});

`;

  const defaultExportMatch = updatedContent.match(defaultExportRegex);
  if (defaultExportMatch) {
    const insertPosition = defaultExportMatch.index!;
    updatedContent =
      updatedContent.slice(0, insertPosition) +
      variantFunction +
      updatedContent.slice(insertPosition);
  }

  return updatedContent;
}

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("Sitecore JSS Extension Activated!");

  const disposable = vscode.commands.registerCommand(
    "sitecore-jss-component-generator.helloWorld",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          "Open a workspace folder before generating a component."
        );
        return;
      }
      const root = workspaceFolders[0].uri;

      const componentType = await vscode.window.showQuickPick(
        ["New Component", "Variant"],
        { placeHolder: "Choose component type" }
      );
      if (!componentType) {
        return;
      }

      let name = "";
      let mainComponentName = "";
      let variantName = "";
      let isVariant = false;
      let parsed: any[] = [];

      if (componentType === "Variant") {
        isVariant = true;
        const mainName = await vscode.window.showInputBox({
          prompt: "Main component name (e.g., Hero)",
        });
        if (!mainName) {
          return;
        }
        mainComponentName = pascalCase(mainName);

        const variant = await vscode.window.showInputBox({
          prompt: "Variant name (e.g., WithCta)",
        });
        if (!variant) {
          return;
        }
        variantName = pascalCase(variant);
        name = variantName; // Use variant name for file generation

        // For variants, we don't need field input as they use the same types as main component
        parsed = [];
      } else {
        // New Component flow
        const rawName = await vscode.window.showInputBox({
          prompt: "Component name (e.g. HeroBanner)",
        });
        if (!rawName) {
          return;
        }
        name = pascalCase(rawName);

        const mode = await vscode.window.showQuickPick(
          ["Simple (name:type,...)", "JSON object"],
          { placeHolder: "Choose input mode for fields" }
        );
        if (!mode) {
          return;
        }

        const fieldsInput = await vscode.window.showInputBox({
          prompt: mode.startsWith("Simple")
            ? "Fields like: title:Text, subtitle:Text, image:Image"
            : 'JSON like: {"title":"Text","image":"Image"}',
          value: mode.startsWith("Simple")
            ? "title:Text, subtitle:Text"
            : '{"title":"Text"}',
        });
        if (!fieldsInput) {
          return;
        }

        parsed = parseFieldsInput(fieldsInput);
      }

      // read config for ComponentProps import path
      const config = vscode.workspace.getConfiguration("sitecoreJss");
      const importPath =
        config.get<string>("componentPropsImportPath") || "lib/component-props";

      const source = generateComponentSource(
        name,
        parsed,
        importPath,
        isVariant,
        mainComponentName,
        variantName
      );

      try {
        let dirUri: vscode.Uri;
        let fileUri: vscode.Uri;
        let fileName: string;

        if (isVariant) {
          // Create variant in the same folder as main component
          dirUri = vscode.Uri.joinPath(
            root,
            "src",
            "components",
            mainComponentName
          );
          fileName = `${variantName}Variant.tsx`;
          fileUri = vscode.Uri.joinPath(dirUri, fileName);

          // Also update the main component to include the variant export
          const mainComponentUri = vscode.Uri.joinPath(
            dirUri,
            `${mainComponentName}.tsx`
          );
          try {
            const mainComponentContent = await vscode.workspace.fs.readFile(
              mainComponentUri
            );
            const mainComponentText =
              Buffer.from(mainComponentContent).toString("utf8");
            const updatedMainComponent = addVariantToMainComponent(
              mainComponentText,
              variantName
            );
            await vscode.workspace.fs.writeFile(
              mainComponentUri,
              Buffer.from(updatedMainComponent, "utf8")
            );
          } catch (err) {
            console.log("Could not update main component:", err);
          }
        } else {
          // Create new component
          dirUri = vscode.Uri.joinPath(root, "src", "components", name);
          await vscode.workspace.fs.createDirectory(dirUri);
          fileName = `${name}.tsx`;
          fileUri = vscode.Uri.joinPath(dirUri, fileName);
        }

        await vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(source, "utf8")
        );

        // open the newly created file
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        if (isVariant) {
          vscode.window.showInformationMessage(
            `Variant ${variantName} created in src/components/${mainComponentName}/${fileName}`
          );
        } else {
          vscode.window.showInformationMessage(
            `Component ${name} created at src/components/${name}/${fileName}`
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          "Failed to create component: " + String(err)
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
