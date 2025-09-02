# Sitecore JSS Component Generator

A VS Code extension that generates Sitecore JSS React components with TypeScript support.

## Features

- **Quick Component Generation**: Generate Sitecore JSS React components with a simple command
- **TypeScript Support**: Full TypeScript support with proper field type mappings
- **Flexible Field Input**: Support for both simple syntax and JSON input for component fields
- **Automatic File Structure**: Creates proper component directory structure with index files
- **Sitecore Field Types**: Built-in support for common Sitecore field types (Text, RichText, Image, Link)
- **Configurable**: Customizable ComponentProps import path

## Usage

1. Open a workspace folder in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run the command: `Sitecore JSS: Create React Component`
4. Enter the component name (e.g., "HeroBanner")
5. Choose input mode for fields:
   - **Simple**: `title:Text, subtitle:Text, image:Image`
   - **JSON**: `{"title":"Text","image":"Image"}`
6. Enter your field definitions

The extension will create:

- `src/components/[ComponentName]/[ComponentName].tsx` - Main component file
- `src/components/[ComponentName]/index.ts` - Barrel export

## Supported Field Types

The extension automatically maps Sitecore field types to their JSS equivalents:

| Input Type | TypeScript Type | JSX Component |
| ---------- | --------------- | ------------- |
| Text       | TextField       | Text          |
| RichText   | RichTextField   | RichText      |
| Image      | ImageField      | Image         |
| Link       | LinkField       | Link          |

## Configuration

The extension supports the following configuration:

- `sitecoreJss.componentPropsImportPath`: Import path for your ComponentProps type (default: `lib/component-props`)

## Example Generated Component

```typescript
import React from "react";
import {
  Text,
  Image,
  TextField,
  ImageField,
} from "@sitecore-jss/sitecore-jss-nextjs";
import { ComponentProps } from "lib/component-props";

interface HeroBannerFields {
  title: TextField;
  subtitle: TextField;
  image: ImageField;
}

export type HeroBannerProps = ComponentProps & {
  fields: HeroBannerFields;
};

const HeroBanner = (props: HeroBannerProps) => {
  return (
    <div id="herobanner">
      <Text field={props.fields.title} tag="h1" />
      <Text field={props.fields.subtitle} tag="h2" />
      <Image field={props.fields.image} />
    </div>
  );
};

export default HeroBanner;
```

## Development

To run the extension in development mode:

1. Clone this repository
2. Run `npm install`
3. Press `F5` to open a new Extension Development Host window
4. Test the extension functionality

## Requirements

- VS Code 1.103.0 or higher
- A Sitecore JSS project workspace

## Release Notes

### 0.0.1

Initial release with basic component generation functionality.
