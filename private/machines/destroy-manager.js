const _ = require('@sailshq/lodash');

module.exports = {
  friendlyName: 'Destroy manager',

  description:
    'Destroy the specified connection manager and destroy all of its active connections.',

  inputs: {
    manager: {
      friendlyName: 'Manager',
      description: 'The connection manager instance to destroy.',
      extendedDescription:
        'Only managers built using the `createManager()` method of this driver are supported.  Also, the database connection manager instance provided must not have already been destroyed--i.e. once `destroyManager()` is called on a manager, it cannot be destroyed again (also note that all existing connections become inactive).',
      example: '===',
      required: true,
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'Additional stuff to pass to the driver.',
      extendedDescription:
        'This is reserved for custom driver-specific extensions.  Please refer to the documentation for the driver you are using for more specific information.',
      example: '===',
    },
  },

  exits: {
    success: {
      description:
        'The specified manager and all of its active connections were successfully destroyed.',
      outputVariableName: 'report',
      outputDescription:
        'The `meta` property is reserved for custom driver-specific extensions.',
      outputExample: '===',
      // example: {
      //   meta: '==='
      // }
    },

    failed: {
      friendlyName: 'Failed',
      description: 'Could not destroy the provided connection manager.',
      extendedDescription:
        'Usually, this means the manager has already been destroyed.  But depending on the driver '
        + 'it could also mean that database cannot be accessed.  In production, this can mean that the database '
        + 'server(s) became overwhelemed or were shut off while some business logic was in progress.',
      outputVariableName: 'report',
      outputDescription:
        'The `error` property is a JavaScript Error instance with more information and a stack trace.  The `meta` property is reserved for custom driver-specific extensions.',
      outputExample: '===',
      // example: {
      //   error: '===',
      //   meta: '==='
      // }
    },
  },

  fn: function destroyManager(inputs, exits) {
    if (!_.isObject(inputs.manager)) {
      return exits.error(
        new Error(
          'The provided `manager` is not a valid manager created by this driver.  (It should be a dictionary which contains a `close` function, at the very least.)',
        ),
      );
    }

    // Not sure if we are supposed to close the connection and How
    // So we just return success
    // ArangoDB manages the opening and closing of connections.   So this is a no op

    return exits.success({
      meta: inputs.meta,
    });
  },
};
