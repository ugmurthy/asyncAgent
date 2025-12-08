import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'error';
  tasksCompleted: number;
}

const AgentDashboard: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([
    { id: '1', name: 'Executor', status: 'running', tasksCompleted: 42 },
    { id: '2', name: 'Planner', status: 'idle', tasksCompleted: 28 },
    { id: '3', name: 'Monitor', status: 'running', tasksCompleted: 156 },
  ]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((e) => e + 1);
      setAgents((agents) =>
        agents.map((agent) => ({
          ...agent,
          tasksCompleted: agent.tasksCompleted + Math.floor(Math.random() * 3),
        }))
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'green';
      case 'idle':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return '●';
      case 'idle':
        return '○';
      case 'error':
        return '✗';
      default:
        return '?';
    }
  };

  const totalTasks = agents.reduce((sum, agent) => sum + agent.tasksCompleted, 0);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Agent Dashboard
        </Text>
        <Text dimColor marginLeft={2}>
          Uptime: {elapsed}s
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="blue" padding={1}>
        <Text color="blue" bold>
          Status Overview
        </Text>
        <Box marginTop={1}>
          <Box width={40}>
            <Text>Running: {agents.filter((a) => a.status === 'running').length}</Text>
          </Box>
          <Box width={40}>
            <Text>Idle: {agents.filter((a) => a.status === 'idle').length}</Text>
          </Box>
        </Box>
        <Text dimColor marginTop={1}>
          Total Tasks: {totalTasks}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          Agents
        </Text>
        {agents.map((agent) => (
          <Box key={agent.id} marginTop={1}>
            <Box width={3}>
              <Text color={getStatusColor(agent.status)}>
                {getStatusIcon(agent.status)}
              </Text>
            </Box>
            <Box width={15}>
              <Text>{agent.name}</Text>
            </Box>
            <Box width={20}>
              <Text dimColor>
                {agent.status === 'running' && <Spinner type="dots" />}
              </Text>
            </Box>
            <Box flex={1}>
              <Text dimColor>{agent.tasksCompleted} tasks</Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};

render(<AgentDashboard />);
