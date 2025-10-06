export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'

// Base type for Log
export type BaseLog = {
  level: LogLevel
  message: string
  stack?: string
  system?: string
  user?: string
}

// Type for Log with id and timestamp
export type Log = BaseLog & {
  id: string
  timestamp: string
}

// Base Salesforce Log type (Salesforce internal representation)
export type BaseSfLog = {
  Level__c: LogLevel
  Message__c: string
  Stack__c?: string
  System__c?: string
  User__c?: string
}

// Salesforce Log type (with Salesforce managed fields)
export type SfLog = BaseSfLog & {
  Id: string
  CreatedDate: string
}

// Transform SalesforceLog to Log (external API)
export function fromSfLog(sfLog: SfLog): Log {
  return {
    id: sfLog.Id,
    level: sfLog.Level__c,
    message: sfLog.Message__c,
    stack: sfLog.Stack__c,
    system: sfLog.System__c,
    user: sfLog.User__c,
    timestamp: sfLog.CreatedDate,
  }
}

// Transform Log (external API) to SalesforceLog
export function toSfLog(log: BaseLog): BaseSfLog {
  return {
    Level__c: log.level,
    Message__c: log.message.slice(0, 255),
    Stack__c: log.stack?.slice(0, 32768),
    System__c: log.system?.slice(0, 255),
    User__c: log.user?.slice(0, 80),
  }
}

export const LOG_OBJECT = 'Log__c'

// note: keep this aligned with SfLog type
export const LOG_FIELDS = [
  'Id',
  'Level__c',
  'Message__c',
  'Stack__c',
  'System__c',
  'User__c',
  'CreatedDate',
]
