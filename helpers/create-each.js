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
      graph,
      graphEnabled,
    } = Helpers.connection.getConnection(inputs.datastore, query.meta);

    let collections = [];
    let collection;
    let result;

    try {
      if (graphEnabled) {
        collections = await graph.listVertexCollections();
      }

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // construct the query statement or better use the Query constructor 👍🏽
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // const sql = aql`FOR record IN ${statement.values} INSERT record INTO ${
      //   statement.tableName
      // }`;

      // result = await dbConnection.query(sql);

      if (_.includes(collections, statement.tableName)) {
        // This is a graph member!

        collection = graph.vertexCollection(`${statement.tableName}`);

        if (WLModel.classType === 'Edge') {
          collection = graph.edgeCollection(`${statement.tableName}`);
        }

        console.log('====================================');
        console.log('st', statement.values);
        console.log('====================================');

        const results = [...(statement.values || [])].map(
          value => new Promise(async (resolve) => {
            const record = await collection.save(value);
            resolve({ new: record });
          }),
        );

        result = await Promise.all(results);
      } else {
        collection = dbConnection.collection(`${statement.tableName}`);

        if (WLModel.classType === 'Edge') {
          collection = dbConnection.edgeCollection(`${statement.tableName}`);
        }
        const opts = { returnNew: fetchRecords, overwrite: true };

        result = await collection.save(statement.values, opts);
      }
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

    const createdRecords = result.map(r => r.new);
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
