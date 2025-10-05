import { Org, Connection } from '@salesforce/core'
import { ComponentSet } from '@salesforce/source-deploy-retrieve'
import { debug } from './debug.js'

/**
 * Returns Org connection.
 * @param aliasOrUsername
 * @param refresh should refresh?
 */
export async function getConnection(
  aliasOrUsername: string,
  refresh: boolean = true
) {
  const org = await Org.create({ aliasOrUsername })
  if (refresh) await org.refreshAuth()
  const conn = org.getConnection()
  return conn
}

export async function executeAnonymous(conn: Connection, body: string) {
  return await conn.tooling.executeAnonymous(body)
}

/**
 * Assign permission set to current user.
 * @param conn
 * @param permissionSetName
 * @return true if assigned, false if already assigned. Throws on error.
 */
export async function assignPermissionSet(
  conn: Connection,
  permissionSetName: string
) {
  try {
    // Get the current user's Id
    const userInfo = await conn.identity()
    const userId = userInfo.user_id

    // Find the permission set by name
    const permissionSetQuery = `SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}'`
    const permissionSetResult = await conn.query(permissionSetQuery)

    if (permissionSetResult.records.length === 0) {
      throw new Error(`Permission set '${permissionSetName}' not found`)
    }

    const permissionSetId = permissionSetResult.records[0].Id

    // Check if assignment already exists
    const existingAssignmentQuery = `SELECT Id FROM PermissionSetAssignment WHERE PermissionSetId = '${permissionSetId}' AND AssigneeId = '${userId}'`
    const existingAssignment = await conn.query(existingAssignmentQuery)

    if (existingAssignment.records.length > 0) {
      debug(`Permission set '${permissionSetName}' is already assigned`)
      return false
    }

    // Create the permission set assignment
    const assignment = {
      PermissionSetId: permissionSetId,
      AssigneeId: userId,
    }

    const result = await conn
      .sobject('PermissionSetAssignment')
      .create(assignment)

    if (result.success) {
      debug(`Permission set '${permissionSetName}' successfully assigned`)
      return true
    } else {
      throw new Error(
        `Failed to assign permission set: ${result.errors?.join(', ')}`
      )
    }
  } catch (error) {
    debug('Permission set assignment failed:', error)
    throw error
  }
}

export async function verifyObject(
  conn: Connection,
  objectName: string,
  requiredFields: string[]
) {
  let describe
  try {
    describe = await conn.sobject(objectName).describe()
  } catch (error) {
    if ((error as any).errorCode === 'NOT_FOUND') {
      debug(`Object ${objectName} not found`)
      return false
    } else {
      throw error
    }
  }
  const existingFields = describe.fields.map((f) => f.name)

  const missingFields = requiredFields.filter(
    (field) => !existingFields.includes(field)
  )

  if (missingFields.length > 0) {
    debug(`Missing fields on ${objectName} object: ${missingFields.join(', ')}`)
    return false
  }

  debug(`${objectName} object verification successful`)
  return true
}

/**
 * Deploy source from a folder.
 *
 * https://github.com/forcedotcom/source-deploy-retrieve/blob/main/HANDBOOK.md#deploying-and-retrieving
 */
export async function deployFolder(conn: Connection, folder: string) {
  const set = await ComponentSet.fromSource(folder)
  const deploy = await set.deploy({
    usernameOrConnection: conn,
  })
  const result = await deploy.pollStatus()

  if (!result.response.success) {
    throw new Error(`Deploy failed: ${JSON.stringify(result.response.details)}`)
  }

  return result
}
