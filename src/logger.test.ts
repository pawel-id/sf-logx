import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { getConnection } from './sf.js'
import { Logger } from './logger.js'
import type { Connection } from '@salesforce/core'

// Read AUTH_URL from environment variable
const username = process.env.AUTH_URL
if (!username) {
  console.error('Error: AUTH_URL environment variable required')
  console.error('Usage: AUTH_URL=<username-or-alias> npx tsx src/logger.test.ts')
  process.exit(1)
}

let conn: Connection
let logger: Logger

describe('Logger', () => {
  before(async () => {
    console.log('Setting up connection and logger...')
    conn = await getConnection(username)
    console.log('Connected as:', conn.getUsername())
    logger = new Logger({ conn })
    await logger.setup()
  })

  test('should log error with Error object', async () => {
    const uniqueMsg = `test-error-${Date.now()}`
    const testError = new Error(uniqueMsg)
    await logger.error(testError)

    // Find our specific log
    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message === uniqueMsg)
    assert.ok(ourLog, 'Should find our error log')
    assert.equal(ourLog.level, 'error')
    assert.ok(ourLog.stack, 'Should have stack trace')
    assert.ok(ourLog.system, 'Should have system field')
    assert.ok(ourLog.user, 'Should have user field')
    assert.ok(ourLog.id, 'Should have id')
    assert.ok(ourLog.timestamp, 'Should have timestamp')
  })

  test('should log error with Error object and cause chain', async () => {
    const uniqueId = Date.now()
    const rootCause = new Error(`Root-${uniqueId}`)
    const middleCause = new Error(`Middle-${uniqueId}`, { cause: rootCause })
    const topError = new Error(`Top-${uniqueId}`, { cause: middleCause })
    
    await logger.error(topError)

    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message.includes(`Top-${uniqueId}`))
    assert.ok(ourLog, 'Should find our error log')
    assert.ok(ourLog.message.includes(`Cause: Middle-${uniqueId}`), 'Should include middle cause')
    assert.ok(ourLog.message.includes(`Cause: Root-${uniqueId}`), 'Should include root cause')
    assert.ok(ourLog.stack?.includes('Caused by:'), 'Stack should include cause chain')
  })

  test('should log error with non-Error thrown value', async () => {
    const uniqueCode = `ERR-${Date.now()}`
    const thrownValue = { code: uniqueCode, details: 'Something went wrong' }
    await logger.error(thrownValue)

    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message.includes(uniqueCode))
    assert.ok(ourLog, 'Should find our error log')
    assert.ok(ourLog.message.startsWith('Non error thrown:'), 'Should prefix non-error')
  })

  test('should log error with custom system and user override', async () => {
    const uniqueMsg = `override-test-${Date.now()}`
    const testError = new Error('Original error message')
    // Note: The log parameter spreads AFTER the generated error message/stack
    // So it can override them
    await logger.error(testError, {
      level: 'error',
      message: uniqueMsg,
      system: 'custom-system',
      user: 'custom-user',
    })

    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message === uniqueMsg)
    assert.ok(ourLog, 'Should find our error log')
    assert.equal(ourLog.system, 'custom-system')
    assert.equal(ourLog.user, 'custom-user')
  })

  test('should log custom message with different levels', async () => {
    const uniqueMsg = `info-test-${Date.now()}`
    await logger.log({
      level: 'info',
      message: uniqueMsg,
    })

    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message === uniqueMsg)
    assert.ok(ourLog, 'Should find our info log')
    assert.equal(ourLog.level, 'info')
  })

  test('should log warning with stack trace', async () => {
    const uniqueMsg = `warning-test-${Date.now()}`
    await logger.log({
      level: 'warn',
      message: uniqueMsg,
      stack: 'Stack trace line 1\nStack trace line 2',
    })

    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message === uniqueMsg)
    assert.ok(ourLog, 'Should find our warning log')
    assert.equal(ourLog.level, 'warn')
    assert.ok(ourLog.stack?.includes('Stack trace line 1'))
  })

  test('should truncate long messages to 255 characters', async () => {
    const uniquePrefix = `LONG-${Date.now()}-`
    const longMessage = uniquePrefix + 'A'.repeat(300)
    await logger.log({
      level: 'info',
      message: longMessage,
    })

    const logs = await logger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message.includes(uniquePrefix))
    assert.ok(ourLog, 'Should find our truncated log')
    // Message is truncated to 255 chars in toSfLog()
    assert.ok(ourLog.message.length <= 255, 'Message should be truncated to max 255 chars')
    assert.ok(ourLog.message.startsWith(uniquePrefix), 'Message should start with our prefix')
  })

  test('should retrieve multiple logs with limit', async () => {
    // Insert a few logs with unique identifiable messages
    const uniqueId = Date.now()
    await logger.log({ level: 'debug', message: `Batch-${uniqueId}-1` })
    await logger.log({ level: 'debug', message: `Batch-${uniqueId}-2` })
    await logger.log({ level: 'debug', message: `Batch-${uniqueId}-3` })

    // Get more logs than we need and filter for our batch
    const logs = await logger.getLogs({ limit: 20 })
    const ourLogs = logs.filter(log => log.message.includes(`Batch-${uniqueId}`))
    
    assert.ok(ourLogs.length >= 3, 'Should retrieve our 3 logs')
    
    // Sort by message suffix to ensure consistent ordering
    ourLogs.sort((a, b) => {
      const aNum = parseInt(a.message.split('-').pop() || '0')
      const bNum = parseInt(b.message.split('-').pop() || '0')
      return bNum - aNum // DESC order: 3, 2, 1
    })
    
    assert.equal(ourLogs[0].message, `Batch-${uniqueId}-3`)
    assert.equal(ourLogs[1].message, `Batch-${uniqueId}-2`)
    assert.equal(ourLogs[2].message, `Batch-${uniqueId}-1`)
  })

  test('should handle fetch error logging', async () => {
    const uniqueHost = `unknown-host-${Date.now()}.com`
    try {
      await fetch(`https://${uniqueHost}`)
    } catch (error) {
      await logger.error(error)
    }

    // Get the most recent log
    const logs = await logger.getLogs({ limit: 5 })
    // Find our log by checking for the unique host in the message
    const ourLog = logs.find(log => log.message.includes(uniqueHost))
    assert.ok(ourLog, 'Should find our error log')
    assert.equal(ourLog.level, 'error')
    assert.ok(ourLog.message.length > 0, 'Should have error message')
  })

  test('should use custom system and user from constructor', async () => {
    const customLogger = new Logger({
      conn,
      system: 'test-system',
      user: 'test-user',
    })

    const uniqueMsg = `custom-defaults-${Date.now()}`
    await customLogger.log({
      level: 'info',
      message: uniqueMsg,
    })

    // Find our specific log
    const logs = await customLogger.getLogs({ limit: 10 })
    const ourLog = logs.find(log => log.message === uniqueMsg)
    assert.ok(ourLog, 'Should find our log')
    assert.equal(ourLog.system, 'test-system')
    assert.equal(ourLog.user, 'test-user')
  })
})
