import { describe, it, expect } from 'vitest'
import { createGoalSchema, updateGoalSchema, goalParamsSchema } from '@async-agent/shared'

describe('Goal Schema Integration', () => {
  describe('createGoalSchema', () => {
    it('should validate a valid goal creation request', () => {
      const validGoal = {
        objective: 'Test objective that is long enough',
        params: {
          stepBudget: 10,
          allowedTools: ['web_search', 'file_read'],
        },
      }

      const result = createGoalSchema.safeParse(validGoal)
      expect(result.success).toBe(true)
    })

    it('should reject objective that is too short', () => {
      const invalidGoal = {
        objective: 'Short',
      }

      const result = createGoalSchema.safeParse(invalidGoal)
      expect(result.success).toBe(false)
    })

    it('should validate goal with webhook URL', () => {
      const validGoal = {
        objective: 'Test objective with webhook',
        webhookUrl: 'https://example.com/webhook',
      }

      const result = createGoalSchema.safeParse(validGoal)
      expect(result.success).toBe(true)
    })

    it('should validate goal with schedule', () => {
      const validGoal = {
        objective: 'Scheduled goal objective',
        schedule: {
          cronExpr: '0 0 * * *',
          timezone: 'America/New_York',
        },
      }

      const result = createGoalSchema.safeParse(validGoal)
      expect(result.success).toBe(true)
    })
  })

  describe('updateGoalSchema', () => {
    it('should validate a valid goal update', () => {
      const validUpdate = {
        status: 'paused' as const,
      }

      const result = updateGoalSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should validate partial updates', () => {
      const validUpdate = {
        objective: 'Updated objective text',
      }

      const result = updateGoalSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should accept valid status values', () => {
      const statuses = ['active', 'paused', 'archived']
      
      statuses.forEach(status => {
        const result = updateGoalSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('goalParamsSchema', () => {
    it('should validate valid params', () => {
      const validParams = {
        stepBudget: 20,
        allowedTools: ['tool1', 'tool2'],
        constraints: { maxRetries: 3 },
      }

      const result = goalParamsSchema.safeParse(validParams)
      expect(result.success).toBe(true)
    })

    it('should reject negative stepBudget', () => {
      const invalidParams = {
        stepBudget: -5,
      }

      const result = goalParamsSchema.safeParse(invalidParams)
      expect(result.success).toBe(false)
    })

    it('should allow empty params', () => {
      const result = goalParamsSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })
})
