import { userInfo, hostname } from 'os'
import { Connection } from '@salesforce/core'
import { setupLog } from './setup.js'
import {
  BaseLog,
  SfLog,
  fromSfLog,
  toSfLog,
  LOG_OBJECT,
  LOG_FIELDS,
} from './types.js'

/**
 * Logger class using Salesforce as backend.
 */
export class Logger {
  private conn: Connection
  private defaults: { system?: BaseLog['system']; user?: BaseLog['user'] }
  private echo: boolean

  constructor(options: {
    conn: Connection
    echo?: boolean
    system?: BaseLog['system']
    user?: BaseLog['user']
  }) {
    this.conn = options.conn
    this.echo = options.echo ?? false
    this.defaults = {
      system: options.system ?? hostname(),
      user: options.user ?? userInfo().username,
    }
  }

  /**
   * Setup the log object in Salesforce if not exists
   */
  async setup() {
    await setupLog(this.conn)
  }

  /**
   * Log a message of any level
   */
  async log(log: BaseLog) {
    const logToInsert = { ...this.defaults, ...log }
    if (this.echo) {
      console.log(JSON.stringify(logToInsert))
    }
    await this.conn.sobject(LOG_OBJECT).insert(toSfLog(logToInsert))
  }

  async trace(message: string, log?: Partial<BaseLog>) {
    await this.log({
      level: 'trace',
      message,
      ...log,
    })
  }

  async debug(message: string, log?: Partial<BaseLog>) {
    await this.log({
      level: 'debug',
      message,
      ...log,
    })
  }

  async info(message: string, log?: Partial<BaseLog>) {
    await this.log({
      level: 'info',
      message,
      ...log,
    })
  }

  async warn(message: string, log?: Partial<BaseLog>) {
    await this.log({
      level: 'warn',
      message,
      ...log,
    })
  }

  /**
   * Log an error, accepts either Error object or any thrown value
   */
  async error(thrown: unknown, log?: Partial<BaseLog>) {
    let message: string
    let stack: string | undefined
    if (thrown instanceof Error) {
      message = thrown.message
      stack = thrown.stack
      let cause = thrown.cause
      while (cause instanceof Error) {
        message += ` | Cause: ${cause.message}`
        stack += `\nCaused by: ${cause.stack}`
        cause = cause.cause
      }
    } else {
      message = `Non error thrown: ${JSON.stringify(thrown)}`
    }
    await this.log({
      level: 'error',
      message,
      stack,
      ...log,
    })
  }

  async fatal(thrown: unknown, log?: Partial<BaseLog>) {
    await this.error(thrown, { level: 'fatal', ...log })
  }

  async getLogs(options?: { limit?: number }) {
    const limit = options?.limit ?? undefined
    const soql = [
      `SELECT ${LOG_FIELDS.join(', ')}`,
      `FROM ${LOG_OBJECT}`,
      `ORDER BY CreatedDate DESC`,
      limit ? `LIMIT ${limit}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const result = await this.conn.query<SfLog>(soql)
    return result.records.map(fromSfLog)
  }
}
