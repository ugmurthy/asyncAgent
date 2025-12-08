import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface BasicExampleProps {
  name?: string;
}

const BasicExample: React.FC<BasicExampleProps> = ({ name = 'Async Agent' }) => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Initializing...');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setMessage('TUI is working!');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {name}
        </Text>
      </Box>

      <Box marginBottom={1}>
        {loading ? (
          <Box>
            <Spinner type="dots" />
            <Text marginLeft={1}>{message}</Text>
          </Box>
        ) : (
          <Text color="green">{message}</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>
          This is a basic Ink TUI example demonstrating:
        </Text>
        <Text dimColor>• Component-based UI with React</Text>
        <Text dimColor>• Flexbox layouts</Text>
        <Text dimColor>• Colors and styles</Text>
        <Text dimColor>• State management</Text>
      </Box>
    </Box>
  );
};

render(<BasicExample />);
