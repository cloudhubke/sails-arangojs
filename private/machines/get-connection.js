module.exports = {
  friendlyName: 'Get connection',

  description:
    'Get an active connection to the database (in Mongo, this is currently a no-op).',

  moreInfoUrl:
    'https://github.com/node-machine/driver-interface/blob/master/machines/get-connection.js',

  sync: true,

  inputs: {
    manager: {
      description: 'A Mongo client instance (e.g. `db`).',
      example: '===',
      required: true,
    },

    meta: {
      friendlyName: 'Meta (unused)',
      description: 'Additional stuff to pass to the driver.',
      example: '===',
    },
  },

  exits: {
    success: {
      outputFriendlyName: 'Report',
      outputDescription:
        'The `connection` property is a Mongo client instance. The `meta` property is unused.',
      // outputExample: {
      //   connection: '===',
      //   meta: '==='
      // }
      outputExample: '===',
    },

    failed: {
      friendlyName: 'Failed (unused)',
      description:
        'Could not acquire a connection to the database via the provided connection manager. (WARNING: Currently, this is ignored by mp-mongo!)',
      outputFriendlyName: 'Report',
      outputExample: {
        error: '===',
        meta: '===',
      },
    },
  },

  fn(inputs, exits) {
    const _ = require('@sailshq/lodash');
    if (!_.isObject(inputs.manager)) {
      return exits.error(
        new Error(
          'The provided `manager` is not a valid manager created by this driver.  (It should be a dictionary which contains a `close` function, at the very least.)'
        )
      );
    }

    return exits.success({
      dbConnection: inputs.manager.connection,
      graph: inputs.manager.graph,
      graphEnabled: inputs.manager.graphEnabled,
      graphName: inputs.manager.graphName,
      Transaction: inputs.manager.Transaction,
      aql: inputs.manager.aql,
      meta: inputs.meta,
    });
  },
};
