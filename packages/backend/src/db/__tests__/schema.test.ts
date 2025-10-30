import { describe, it, expect } from 'vitest'
import { goals, runs, steps, outputs, memories, schedules } from '../schema'

describe('Database Schema', () => {
  describe('goals table', () => {
    it('should have correct column names', () => {
      expect(goals.id).toBeDefined()
      expect(goals.objective).toBeDefined()
      expect(goals.params).toBeDefined()
      expect(goals.webhookUrl).toBeDefined()
      expect(goals.status).toBeDefined()
      expect(goals.createdAt).toBeDefined()
      expect(goals.updatedAt).toBeDefined()
    })
  })

  describe('runs table', () => {
    it('should have correct column names', () => {
      expect(runs.id).toBeDefined()
      expect(runs.goalId).toBeDefined()
      expect(runs.status).toBeDefined()
      expect(runs.startedAt).toBeDefined()
      expect(runs.endedAt).toBeDefined()
      expect(runs.workingMemory).toBeDefined()
      expect(runs.stepBudget).toBeDefined()
      expect(runs.stepsExecuted).toBeDefined()
      expect(runs.error).toBeDefined()
      expect(runs.createdAt).toBeDefined()
    })
  })

  describe('steps table', () => {
    it('should have correct column names', () => {
      expect(steps.id).toBeDefined()
      expect(steps.runId).toBeDefined()
      expect(steps.stepNo).toBeDefined()
      expect(steps.thought).toBeDefined()
      expect(steps.toolName).toBeDefined()
      expect(steps.toolInput).toBeDefined()
      expect(steps.observation).toBeDefined()
      expect(steps.durationMs).toBeDefined()
      expect(steps.error).toBeDefined()
      expect(steps.createdAt).toBeDefined()
    })
  })

  describe('outputs table', () => {
    it('should have correct column names', () => {
      expect(outputs.id).toBeDefined()
      expect(outputs.runId).toBeDefined()
      expect(outputs.kind).toBeDefined()
      expect(outputs.pathOrPayload).toBeDefined()
      expect(outputs.createdAt).toBeDefined()
    })
  })

  describe('memories table', () => {
    it('should have correct column names', () => {
      expect(memories.id).toBeDefined()
      expect(memories.goalId).toBeDefined()
      expect(memories.type).toBeDefined()
      expect(memories.content).toBeDefined()
      expect(memories.metadata).toBeDefined()
      expect(memories.createdAt).toBeDefined()
    })
  })

  describe('schedules table', () => {
    it('should have correct column names', () => {
      expect(schedules.id).toBeDefined()
      expect(schedules.goalId).toBeDefined()
      expect(schedules.cronExpr).toBeDefined()
      expect(schedules.timezone).toBeDefined()
      expect(schedules.active).toBeDefined()
      expect(schedules.createdAt).toBeDefined()
    })
  })
})
