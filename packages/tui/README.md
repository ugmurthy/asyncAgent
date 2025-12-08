# @async-agent/tui

Terminal User Interface (TUI) package built with Ink - React for the terminal.

## Features

- React-based component system for building CLI applications
- Flexbox layout engine for responsive terminal UIs
- Rich ecosystem of pre-built components (inputs, spinners, tables)
- Full TypeScript support
- Accessible and tested components

## Installation

```bash
pnpm install
```

## Quick Start

### Basic Example

Run the basic example to see Ink in action:

```bash
pnpm run example:basic
```

This demonstrates:
- Component-based UI structure
- Flexbox layouts with borders
- Colors and text styling
- State management with hooks
- Loading spinners

### Todo List Example

Run the interactive todo list example:

```bash
pnpm run example:todo
```

This demonstrates:
- Select input component
- Text input component
- Interactive state management
- Real-time UI updates

### Agent Dashboard Example

Run the agent dashboard example:

```bash
pnpm run example:dashboard
```

This demonstrates:
- Real-time data updates
- Complex layouts with nested boxes
- Status indicators and icons
- Progress tracking
- Perfect for monitoring async agent systems

## Development

Watch mode for development:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

## Usage

Import components from the package:

```tsx
import { Box, Text, Spinner, TextInput, SelectInput } from '@async-agent/tui';

export const MyApp = () => {
  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>My TUI App</Text>
      <Spinner type="dots" />
    </Box>
  );
};
```

## Available Components

- **Box** - Flexbox container (like div with display: flex)
- **Text** - Text rendering with styling
- **Spinner** - Loading spinner
- **TextInput** - Single-line text input
- **SelectInput** - Interactive select/dropdown list

## Resources

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Ink Components List](https://github.com/vadimdemedes/ink#useful-components)
- [React Hooks Documentation](https://react.dev/reference/react)

## Styling

Ink supports:
- Colors: `cyan`, `green`, `red`, `yellow`, `blue`, `magenta`, `white`, `gray`, `black`
- Modifiers: `bold`, `dim`, `italic`, `underline`, `strikethrough`, `inverse`
- Flexbox properties: `flexDirection`, `alignItems`, `justifyContent`, `margin`, `padding`

## Tips

- All text must be wrapped in `<Text>` components
- Every element is a flex container by default
- Use `dimColor` for secondary text
- Test components with `ink-testing-library`
- Screen reader support available via `INK_SCREEN_READER` env var

## License

MIT
