import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const TodoApp: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: 'Learn Ink TUI', completed: true },
    { id: '2', text: 'Build CLI app', completed: false },
    { id: '3', text: 'Deploy to production', completed: false },
  ]);
  const [inputMode, setInputMode] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      setTodos([
        ...todos,
        {
          id: Date.now().toString(),
          text: newTodoText,
          completed: false,
        },
      ]);
      setNewTodoText('');
      setInputMode(false);
    }
  };

  const handleSelect = (item: { value: string; label: string }) => {
    if (item.value === 'add') {
      setInputMode(true);
    } else {
      const id = item.value;
      setTodos(
        todos.map((todo) =>
          todo.id === id ? { ...todo, completed: !todo.completed } : todo
        )
      );
    }
  };

  const selectItems = [
    ...todos.map((todo) => ({
      label: `${todo.completed ? '✓' : ' '} ${todo.text}`,
      value: todo.id,
    })),
    { label: '+ Add new todo', value: 'add' },
  ];

  if (inputMode) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Add a new todo:</Text>
        <Box marginTop={1}>
          <Text>› </Text>
          <TextInput
            value={newTodoText}
            onChange={setNewTodoText}
            onSubmit={handleAddTodo}
            placeholder="Enter todo text..."
          />
        </Box>
      </Box>
    );
  }

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="blue">
      <Box marginBottom={1}>
        <Text bold color="blue">
          Todo List
        </Text>
        <Text dimColor marginLeft={2}>
          ({completedCount}/{todos.length} completed)
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <SelectInput
          items={selectItems}
          onSelect={handleSelect}
          indicatorComponent={({ isSelected }) => (
            <Text color={isSelected ? 'green' : 'gray'}>{isSelected ? '› ' : '  '}</Text>
          )}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor fontSize="small">
          ↑↓ to navigate • Enter to toggle/add • Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

render(<TodoApp />);
