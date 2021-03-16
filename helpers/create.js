//   ██████╗██████╗ ███████╗ █████╗ ████████╗███████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║     ██████╔╝█████╗  ███████║   ██║   █████╗      ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██╔══╝      ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ╚██████╗██║  ██║███████╗██║  ██║   ██║   ███████╗    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//   ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'Create',

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

  fn: async function create(inputs, exits) {
    // Dependencies
    const validateSchema = require('./private/schema/validate-schema');
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');
    // Store the Query input for easier access
    const { query } = inputs;
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
        method: 'create',
        values: newrecords[0],
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
      Transaction,
      dbConnection,
      graph,
      graphEnabled,
      dsName,
    } = Helpers.connection.getConnection(inputs.datastore, query.meta);

    let collections = [];

    let createdRecord = {};
    let collection;

    if (graphEnabled) {
      collections = await graph.listVertexCollections();
    }

    try {
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // SCHEMA VALIDATION
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      const aql = `RETURN SCHEMA_GET("${statement.tableName}")`;

      const schema = await Transaction({
        action: function ({ aql }) {
          const result = db._query(aql).toArray()[0];
          return result.rule;
        },
        writes: [],
        params: {
          aql,
        },
      });

      validateSchema(WLModel, schema, {
        ...statement.values,
      });

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // END SCHEMA VALIDATION
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // Execute sql using the driver acquired graph.

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // Model the query OR INSERT USING THE  Query Builder! 👍🏽
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -å
      // Execute sql using the driver acquired graph.
      if (_.includes(collections, statement.tableName)) {
        // This is a graph member!

        collection = graph.vertexCollection(`${statement.tableName}`);

        if (WLModel.classType === 'Edge') {
          collection = graph.edgeCollection(`${statement.tableName}`);
        }

        const result = await collection.save(statement.values);

        if (fetchRecords) {
          createdRecord = await collection.document(result[pkColumnName]);

          createdRecord = global[`${WLModel.globalId}Object`].initialize(
            createdRecord,
            dsName
          );
        }
      } else {
        collection = dbConnection.collection(`${statement.tableName}`);

        if (WLModel.classType === 'Edge') {
          collection = dbConnection.edgeCollection(`${statement.tableName}`);
        }

        const opts = { returnNew: fetchRecords };
        const result = await collection.save(statement.values, opts);

        createdRecord = global[`${WLModel.globalId}Object`].initialize(
          result.new,
          dsName
        );
      }
    } catch (err) {
      if (graph) {
        // Close the Session.
        Helpers.connection.releaseConnection(graph);
      }

      if (err.code === 409) {
        return exits.notUnique(err);
      }
      return exits.badConnection(new Error(`\n\n Error ${err} \n\n`));
    }
    if (!fetchRecords) {
      Helpers.connection.releaseConnection(dbConnection);
      return exits.success();
    }

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
