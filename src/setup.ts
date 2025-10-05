import path from 'node:path'
import { Connection } from '@salesforce/core'
import { assignPermissionSet, deployFolder, verifyObject } from './sf.js'
import { LOG_OBJECT, LOG_FIELDS } from './types.js'

export async function verifyLog(conn: Connection) {
  return await verifyObject(conn, LOG_OBJECT, LOG_FIELDS)
}

export async function deployLog(conn: Connection) {
  const folder = path.resolve(import.meta.dirname, '..', 'force')
  return await deployFolder(conn, folder)
}

export async function assignPermissionSetForLog(conn: Connection) {
  return assignPermissionSet(conn, 'Log')
}

export async function setupLog(conn: Connection) {
  if (!(await verifyLog(conn))) {
    await deployLog(conn)
    await assignPermissionSetForLog(conn)
    if (!(await verifyLog(conn))) {
      throw new Error('Log object setup failed')
    }
  }
}
