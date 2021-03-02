/*eslint-disable */

//   ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗    ███████╗ █████╗  ██████╗██╗  ██╗
//  ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝    ██╔════╝██╔══██╗██╔════╝██║  ██║
//  ██║     ██████╔╝█████╗  ███████║   ██║   █████╗      █████╗  ███████║██║     ███████║
//  ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝      ██╔══╝  ██╔══██║██║     ██╔══██║
//  ╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗    ███████╗██║  ██║╚██████╗██║  ██║
//   ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
//
//   █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'Create Each',

  description: 'Insert multiple records into a table in the database.',

  inputs: {
    datastore: {
      description: 'The datastore to use for connections.',
      extendedDescription:
        'Datastores represent the config and manager required to obtain an active database connection.',
      required: true,
      readOnly: true,
      example: '===',
    },

    models: {
      description:
        'An object containing all of the model definitions that have been registered.',
      required: true,
      example: '===',
    },

    query: {
      description: 'A valid stage three Waterline query.',
      required: true,
      example: '===',
    },
  },

  exits: {
    success: {
      description: 'The record was successfully inserted.',
      outputVariableName: 'record',
      outputExample: '===',
    },

    invalidDatastore: {
      description: 'The datastore used is invalid. It is missing key pieces.',
    },

    badConnection: {
      friendlyName: 'Bad connection',
      description:
        'A connection either could not be obtained or there was an error using the connection.',
    },

    notUnique: {
      friendlyName: 'Not Unique',
      outputExample: '===',
    },
  },

  fn: async function create(inputs, exits) {
    const { query } = inputs;
    // Dependencies
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');

    // Store the Query input for easier access
    query.meta = query.meta || {};

    // Find the model definition

    const WLModel = inputs.models[query.using];

    if (!WLModel) {
      return exits.invalidDatastore();
    }

    // Grab the pk column name (for use below)
    let pkColumnName;
    try {
      pkColumnName = WLModel.attributes[WLModel.primaryKey].columnName;
    } catch (e) {
      return exits.error(e);
    }

    // Set a flag to determine if records are being returned
    let fetchRecords = false;

    //  ╔═╗╦═╗╔═╗  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
    //  ╠═╝╠╦╝║╣───╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  ├┬┘├┤ │  │ │├┬┘ ││└─┐
    //  ╩  ╩╚═╚═╝  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
    // Process each record to normalize output
    let newrecords = query.newRecords;

    try {
      newrecords = Helpers.query.preProcessRecord({
        records: newrecords,
        identity: WLModel.identity,
        model: WLModel,
      });
    } catch (e) {
      return exits.error(e);
    }

    //  ╔═╗╔═╗╔╗╔╦  ╦╔═╗╦═╗╔╦╗  ┌┬┐┌─┐  ┌─┐┌┬┐┌─┐┌┬┐┌─┐┌┬┐┌─┐┌┐┌┌┬┐
    //  ║  ║ ║║║║╚╗╔╝║╣ ╠╦╝ ║    │ │ │  └─┐ │ ├─┤ │ ├┤ │││├┤ │││ │
    //  ╚═╝╚═╝╝╚╝ ╚╝ ╚═╝╩╚═ ╩    ┴ └─┘  └─┘ ┴ ┴ ┴ ┴ └─┘┴ ┴└─┘┘└┘ ┴
    // Convert the Waterline criteria into a Waterline Query Statement. This
    // turns it into something that is declarative and can be easily used to
    // build a SQL query.
    // See: https://github.com/treelinehq/waterline-query-docs for more info
    // on Waterline Query Statements.

    let statement;
    try {
      statement = Helpers.query.compileStatement({
        pkColumnName,
        model: query.using,
        method: 'createEach',
        values: newrecords,
      });
    } catch (e) {
      return exits.error(e);
    }

    //  ╔╦╗╔═╗╔╦╗╔═╗╦═╗╔╦╗╦╔╗╔╔═╗  ┬ ┬┬ ┬┬┌─┐┬ ┬  ┬  ┬┌─┐┬  ┬ ┬┌─┐┌─┐
    //   ║║║╣  ║ ║╣ ╠╦╝║║║║║║║║╣   │││├─┤││  ├─┤  └┐┌┘├─┤│  │ │├┤ └─┐
    //  ═╩╝╚═╝ ╩ ╚═╝╩╚═╩ ╩╩╝╚╝╚═╝  └┴┘┴ ┴┴└─┘┴ ┴   └┘ ┴ ┴┴─┘└─┘└─┘└─┘
    //  ┌┬┐┌─┐  ┬─┐┌─┐┌┬┐┬ ┬┬─┐┌┐┌
    //   │ │ │  ├┬┘├┤  │ │ │├┬┘│││
    //   ┴ └─┘  ┴└─└─┘ ┴ └─┘┴└─┘└┘
    if (_.has(query.meta, 'fetch') && query.meta.fetch) {
      fetchRecords = true;
    }

    //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
    //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    //  ┌─┐┬─┐  ┬ ┬┌─┐┌─┐  ┬  ┌─┐┌─┐┌─┐┌─┐┌┬┐  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  │ │├┬┘  │ │└─┐├┤   │  ├┤ ├─┤└─┐├┤  ││  │  │ │││││││├┤ │   │ ││ ││││
    //  └─┘┴└─  └─┘└─┘└─┘  ┴─┘└─┘┴ ┴└─┘└─┘─┴┘  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    // Spawn a new connection for running queries on.

    const {
      dbConnection,
      Transaction,
      dsName,
    } = Helpers.connection.getConnection(inputs.datastore, query.meta);

    let result;

    try {
      result = await Transaction({
        action: function (params) {
          const col = db._collection(params.collection);
          const results = col.insert(params.values, params.options);

          return results;
        },
        writes: [`${statement.tableName}`],
        params: {
          collection: `${statement.tableName}`,
          values: statement.values || [],
          options: { returnNew: fetchRecords, overwrite: true },
        },
      });
    } catch (error) {
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }
      return exits.error(error);
    }

    // If `fetch` is NOT enabled, we're done.

    if (!fetchRecords) {
      Helpers.connection.releaseConnection(dbConnection);
      return exits.success();
    }

    // Otherwise, IWMIH we'll be sending back records:
    // ============================================

    //  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┌┐┌┌─┐┌┬┐┬┬  ┬┌─┐  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┌─┐─┐
    //  ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  │││├─┤ │ │└┐┌┘├┤   ├┬┘├┤ │  │ │├┬┘ │││ └─┐ │
    //  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┘└┘┴ ┴ ┴ ┴ └┘ └─┘  ┴└─└─┘└─┘└─┘┴└──┴┘└─└─┘─┘
    // Process record(s) (mutate in-place) to wash away adapter-specific eccentricities.

    const createdRecords = result.map((r) =>
      global[`${WLModel.globalId}Object`].initialize(r.new, dsName)
    );
    try {
      _.each(createdRecords, (record) => {
        Helpers.query.processNativeRecord(record, WLModel, query.meta);
      });
    } catch (e) {
      return exits.error(e);
    }
    return exits.success({ records: createdRecords });
  },
});
