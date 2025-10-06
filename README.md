# sf-log - Logger to Salesforce

This library offers a logging utility that uses Salesforce Org as the backend
for storing log entries. While Salesforce is not typically the preferred
database for logging, it can be a suitable or necessary option in certain
scenarios. If you have the flexibility to choose another solution, consider your
requirements carefully.

In order to use this library you need to have a Salesforce Org and a connection
to it.

### Usage Example

```ts
import { Logger } from 'sf-log'

const logger = new Logger({ conn: mySalesforceConnection })

// optional step to ensure setup of Log__c object and PermissionSet
await logger.setup()

// log messages
logger.info('Hello!')
logger.error(new Error('Serious exception occurred'))
```

Log entries are stored in the Salesforce `Log__c` object, making them accessible
for retrieving, filtering on the Org e.g. via SOQL queries:

```sql
SELECT Id, Level__c, Message__c, Stack__c, System__c, User__c, CreatedDate
FROM Log__c
ORDER BY CreatedDate DESC
```

## Salesforce backend

### Log Object Overview

The `Log` object is a custom Salesforce object designed to store application log
entries. Its metadata includes:

- **Fields**:

  - `level__c` (Picklist): Log severity (e.g., debug, info, warn, error).
  - `Message__c` (Long Text): The log message content.
  - `Stack__c` (Long Text): Stack trace or error details, if applicable.
  - `System__c` (Text): The system or application name generating the log.
  - `User__c` (Text): The user associated with the log entry.

- **Permissions**:

  - Access is managed via a Permission Set (e.g., `Log`), which can be assigned
    to users who need to view or manage logs.

## Troubleshooting

Necessary object and permission set is created automatically when you call
`logger.setup()`. If you want to do it manually, you can use the provided
metadata files located in the `force/log` directory.

1. `sf project deploy start -d force/log -o alias`
2. Assign PermissionsSet `Log` to appropriate users
