//   ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║     ██████╔╝█████╗  ███████║   ██║   █████╗      ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝      ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//   ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

const sleep = (time = 5000) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
};

module.exports = require('machine').build({
  friendlyName: 'Create Edge',

  description: 'Insert a record into a table in the database.',

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
      outputType: 'ref',
    },

    invalidDatastore: {
      description: 'The datastore used is invalid. It is missing key pieces.',
    },

    invalidVertex: {
      description:
        'One of the documents used to create the edge is invalid or does not exist.',
    },

    badConnection: {
      friendlyName: 'Bad connection',
      description:
        'A connection either could not be obtained or there was an error using the connection.',
    },

    notUnique: {
      friendlyName: 'Not Unique',
      outputType: 'ref',
    },
  },

  fn: async function createEdge(inputs, exits) {
    // Dependencies
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');
    // Store the Query input for easier access
    const { query } = inputs;

    const { params } = query;

    query.meta = query.meta || {};

    if (_.isUndefined(params) || !_.isPlainObject(params)) {
      throw new Error(
        'Invalid options argument. Options must contain: records, identity, and orm.'
      );
    }
    // Check for params to, and from
    if (!_.has(params, 'to') || !_.isString(params.to)) {
      throw new Error(
        'Invalid option used in options argument. Missing or invalid `to` parameter in params boject.'
      );
    }

    if (!_.has(params, 'from') || !_.isString(params.from)) {
      throw new Error(
        'Invalid option used in options argument. Missing or invalid `from` parameter in the params object.'
      );
    }

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
    let newrecords = [];
    try {
      newrecords = Helpers.query.preProcessRecord({
        records: [query.newRecord],
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
        method: 'createEdge',
        values: newrecords[0],
        params: query.params,
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

    const { dbConnection, dsName } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta
    );

    let createdRecord = {};

    try {
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // Model the query OR INSERT USING THE  Query Builder! 👍🏽
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -å

      // Execute sql using the driver acquired dbConnection.

      const [fromCollection, fromDocument] = params.from.split('/');
      const [toCollection, toDocument] = params.from.split('/');

      // check if document exists
      const fromVertex = dbConnection.collection(`${fromCollection}`);
      const fromExists = await fromVertex.documentExists(`${fromDocument}`);

      if (!fromExists) {
        return exits.invalidVertex(
          'The `from` document in the created vertex does not exist '
        );
      }

      const toVertex = dbConnection.collection(`${toCollection}`);
      const toExists = await toVertex.documentExists(`${toDocument}`);

      if (!toExists) {
        return exits.invalidVertex(
          'The `to` document in the created vertex does not exist '
        );
      }

      const opts = { returnNew: fetchRecords };
      let collection = await dbConnection.collection(`${statement.tableName}`);
      const exists = await collection.exists();
      if (!exits) {
        try {
          collection = await dbConnection.createEdgeCollection(
            `${statement.tableName}`
          );
        } catch (error) {}
      }

      const result = await collection.save(
        { ...statement.values, _from: params.from, _to: params.to },
        opts
      );

      if (fetchRecords) {
        createdRecord = global[`${WLModel.globalId}Object`].initialize(
          result.new,
          dsName,
          true
        );
      }
    } catch (err) {
      if (dbConnection) {
        // Close the Session.
        Helpers.connection.releaseConnection(dbConnection);
      }
      if (err.code === 409) {
        return exits.notUnique(err);
      }
      return exits.badConnection(err);
    }
    // Close the Session.
    Helpers.connection.releaseConnection(dbConnection);

    try {
      Helpers.query.processNativeRecord(createdRecord, WLModel, query.meta);
    } catch (error) {
      return exits.invalidDatastore(
        'Records could not math with your model attributes '
      );
    }

    return exits.success({ record: fetchRecords ? createdRecord : null });
  },
});
