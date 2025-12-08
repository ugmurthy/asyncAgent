# @async-agent/tui Architecture

## Overview

The TUI package provides a React-based terminal user interface framework built on Ink, specifically tailored for the Async Agent system. It enables developers to build interactive, component-driven CLIs with full TypeScript support.

## Why Ink?

After evaluating multiple TUI libraries:

- **Ink**: React paradigm, mature ecosystem, production-tested (used by Cloudflare, Google, Shopify)
- **OpenTUI**: Modern but still in beta (v0.1.x), smaller ecosystem
- **Terminal-Kit**: Low-level control, more verbose, less component-driven

We chose **Ink** for:
1. Familiar React component model
2. Large ecosystem of pre-built components
3. Production-proven stability
4. Excellent TypeScript support
5. Easy testing with ink-testing-library

## Package Structure

```
src/
├── index.ts              # Main exports
└── examples/
    ├── basic.tsx         # Basic component example
    ├── todo.tsx          # Interactive todo list
    └── agent-dashboard.tsx # Real-time agent monitoring
```

## Key Concepts

### Components

All UIs are composed of React components using TSX/JSX:

```tsx
import { Box, Text } from 'ink';

const MyApp = () => (
  <Box flexDirection="column">
    <Text color="cyan">Hello TUI!</Text>
  </Box>
);
```

### Layout System

Ink uses Yoga (Facebook's Flexbox implementation):
- Every component is a flex container
- CSS-like properties work as expected
- Use `<Box>` for layout, `<Text>` for text

```tsx
<Box flexDirection="column" padding={1} borderStyle="round">
  <Box marginBottom={1}>
    <Text>Item 1</Text>
  </Box>
  <Box>
    <Text>Item 2</Text>
  </Box>
</Box>
```

### State Management

Use React hooks normally:

```tsx
const [count, setCount] = useState(0);

useEffect(() => {
  const timer = setTimeout(() => setCount(count + 1), 1000);
  return () => clearTimeout(timer);
}, [count]);
```

### Input Handling

Handle keyboard and user input:

```tsx
import TextInput from 'ink-text-input';

const [value, setValue] = useState('');

<TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
```

## Component Exports

The main index.ts re-exports commonly used components:

- **Box** - Flex container
- **Text** - Text rendering
- **Spinner** - Loading indicator
- **TextInput** - Single-line input
- **SelectInput** - Dropdown/menu selection

## Examples

### 1. Basic Example (`basic.tsx`)
- Loading state with spinner
- Styled output with colors and borders
- Simple state management
- Demonstrates UI fundamentals

### 2. Todo Example (`todo.tsx`)
- Interactive menu navigation
- Text input for new items
- List state management
- Input mode switching

### 3. Agent Dashboard (`agent-dashboard.tsx`)
- Real-time data updates with intervals
- Complex nested layouts
- Status indicators
- Progress tracking
- Perfect template for agent monitoring

## Integration with Async Agent

The TUI package is designed to integrate with the async agent system:

### Dashboard Use Cases

1. **Agent Monitor** - Display agent status and task count
2. **Execution Viewer** - Show running DAGs and their progress
3. **Task Queue** - Interactive task management UI
4. **Log Viewer** - Real-time log streaming

### Example Integration

```tsx
import { useAgent } from '@async-agent/backend';
import { Box, Text } from '@async-agent/tui';

const AgentMonitor = ({ agentId }: { agentId: string }) => {
  const agent = useAgent(agentId);
  
  return (
    <Box>
      <Text>{agent.name}</Text>
      <Text color={agent.active ? 'green' : 'yellow'}>
        {agent.active ? 'Running' : 'Idle'}
      </Text>
    </Box>
  );
};
```

## Styling

### Colors

Available colors: cyan, green, red, yellow, blue, magenta, white, gray, black

```tsx
<Text color="cyan">Colored text</Text>
```

### Modifiers

- `bold` - Bold text
- `dim` - Dimmed/faded text
- `italic` - Italic text (if supported)
- `underline` - Underlined text
- `strikethrough` - Strikethrough text
- `inverse` - Inverted colors

```tsx
<Text bold color="green">Success!</Text>
<Text dimColor>Secondary text</Text>
```

### Borders

Available border styles: `single`, `double`, `round`, `bold`

```tsx
<Box borderStyle="round" borderColor="cyan">
  <Text>Content</Text>
</Box>
```

## Testing

Use `ink-testing-library` for component testing:

```tsx
import { render } from 'ink-testing-library';
import MyComponent from './my-component';

test('renders correctly', () => {
  const { lastFrame } = render(<MyComponent />);
  expect(lastFrame()).toContain('Expected text');
});
```

## Performance Considerations

1. **Re-renders** - Minimize state updates for smooth rendering
2. **Intervals** - Clean up timers/intervals in useEffect cleanup
3. **Large lists** - Consider virtualization for very long lists
4. **API calls** - Use async state management patterns

## Best Practices

1. **Always wrap text in `<Text>`** - Required for proper rendering
2. **Use Box for layout** - Don't rely on flex by default
3. **Cleanup effects** - Always return cleanup function from useEffect
4. **Type your props** - Use TypeScript interfaces for component props
5. **Test accessibility** - Use screen reader support for CLI tools
6. **Handle Ctrl+C gracefully** - Users expect Ctrl+C to exit

## Dependencies

- **ink** (^4.4.1) - React renderer for terminal
- **react** (^18.2.0) - UI component library
- **ink-spinner**, **ink-text-input**, **ink-select-input** - Utility components

## Future Enhancements

1. Pre-built async agent components
2. Integration with backend API for live monitoring
3. Theme system for consistent styling
4. Animation library for smooth transitions
5. Table component with sorting/filtering
6. More complex form components

## Troubleshooting

### Component not rendering
- Ensure all text is wrapped in `<Text>`
- Check that JSX is properly imported
- Verify React component syntax

### Styling not applied
- Use `Box` for layout containers
- Apply colors to `<Text>` components
- Check color name spelling

### Input not working
- Ensure stdin is not piped
- Use proper event handlers
- Check Ink version compatibility

## References

- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink Components](https://github.com/vadimdemedes/ink#useful-components)
- [React Documentation](https://react.dev)
- [Yoga Flexbox](https://yogalayout.dev)
