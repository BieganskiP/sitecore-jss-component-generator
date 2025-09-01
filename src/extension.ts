// src/extension.ts
import * as vscode from "vscode";
import { parseFieldsInput, generateComponentSource } from "./generator";
import { pascalCase } from "./utils";

export function activate(context: vscode.ExtensionContext) {
  console.log("Sitecore JSS Component Generator extension is now active!");
  vscode.window.showInformationMessage("Sitecore JSS Extension Activated!");

  const disposable = vscode.commands.registerCommand(
    "sitecore-jss-component-generator.helloWorld",
    async () => {
      console.log("Command executed!");
      vscode.window.showInformationMessage(
        "Command started! Extension is working!"
      );
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          "Open a workspace folder before generating a component."
        );
        return;
      }
      const root = workspaceFolders[0].uri;

      const rawName = await vscode.window.showInputBox({
        prompt: "Component name (e.g. HeroBanner)",
      });
      if (!rawName) {
        return;
      }
      const name = pascalCase(rawName);

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

      const parsed = parseFieldsInput(fieldsInput);

      // read config for ComponentProps import path
      const config = vscode.workspace.getConfiguration("sitecoreJss");
      const importPath =
        config.get<string>("componentPropsImportPath") || "lib/component-props";

      const source = generateComponentSource(name, parsed, importPath);

      try {
        const dirUri = vscode.Uri.joinPath(root, "src", "components", name);
        await vscode.workspace.fs.createDirectory(dirUri);

        const fileUri = vscode.Uri.joinPath(dirUri, `${name}.tsx`);
        await vscode.workspace.fs.writeFile(
          fileUri,
          Buffer.from(source, "utf8")
        );

        // barrel index.ts
        const indexSource = `export { default } from './${name}';\n`;
        const indexUri = vscode.Uri.joinPath(dirUri, "index.ts");
        await vscode.workspace.fs.writeFile(
          indexUri,
          Buffer.from(indexSource, "utf8")
        );

        // open the newly created file
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(
          `Component ${name} created at src/components/${name}/`
        );
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
