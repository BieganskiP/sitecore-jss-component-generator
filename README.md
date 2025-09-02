# Sitecore JSS Component Generator

A VS Code extension that generates Sitecore JSS React components with TypeScript support, including advanced variant management.

## Features

- **Quick Component Generation**: Generate Sitecore JSS React components with a simple command
- **Component Variants**: Create component variants that share the same field structure
- **TypeScript Support**: Full TypeScript support with proper field type mappings
- **Flexible Field Input**: Support for both simple syntax and JSON input for component fields
- **Smart Import Management**: Automatically detects and imports required Sitecore JSS types
- **Sitecore Field Types**: Built-in support for common Sitecore field types (Text, RichText, Image, Link)
- **Configurable Paths**: Customizable component creation path and ComponentProps import path
- **Auto-Export Variants**: Automatically updates main components to export variants

## Usage

1. Open a workspace folder in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run the command: `Sitecore JSS: Create React Component`
4. Choose component type:
   - **New Component**: Create a brand new component
   - **Variant**: Create a variant of an existing component

### Creating New Components

1. Select "New Component"
2. Enter the component name (e.g., "HeroBanner")
3. Choose input mode for fields:
   - **Simple**: `title:Text, subtitle:Text, image:Image`
   - **JSON**: Paste actual Sitecore field data structure
4. Enter your field definitions

Creates: `[componentsPath]/[ComponentName]/[ComponentName].tsx`

### Creating Variants

1. Select "Variant"
2. Enter the main component name (e.g., "Hero")
3. Enter the variant name (e.g., "WithCta")

Creates: `[componentsPath]/[MainComponent]/[VariantName]Variant.tsx`
Also updates the main component to export the variant.

## Supported Field Types

The extension automatically maps Sitecore field types to their JSS equivalents:

| Input Type | TypeScript Type | JSX Component |
| ---------- | --------------- | ------------- |
| Text       | TextField       | Text          |
| RichText   | RichTextField   | RichText      |
| Image      | ImageField      | Image         |
| Link       | LinkField       | Link          |

## Configuration

The extension supports the following configuration options in VS Code settings:

- `sitecoreJss.componentPropsImportPath`: Import path for your ComponentProps type (default: `lib/component-props`)
- `sitecoreJss.componentsPath`: Base path where components should be created (default: `src/components`)

### Setting Up Configuration

1. Open VS Code Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "Sitecore JSS"
3. Configure the paths according to your project structure

Or add to your `settings.json`:

```json
{
  "sitecoreJss.componentPropsImportPath": "lib/component-props",
  "sitecoreJss.componentsPath": "src/components"
}
```

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

## Component Types

### New Components

- Creates a complete component with interfaces, types, and proper exports
- Uses `withDatasourceCheck()` wrapper for Sitecore integration
- Supports complex nested item structures with automatic interface generation

### Variants

- Creates lightweight variants that reuse main component types
- Automatically updates main component to export the variant
- Perfect for different visual representations of the same data structure
- No duplicate type definitions

## Requirements

- VS Code 1.74.0 or higher
- A Sitecore JSS project workspace

## Release Notes

### 1.0.0

- Complete rewrite with advanced variant support
- Configurable component creation paths
- Smart import management
- Proper Sitecore field structure support
- Auto-updating main components when variants are added
