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

  fn: async function normalize(inputs, exits) {
    // Dependencies
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
    const fetchRecords = false;

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

    let normalizedRecord = {};

    try {
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // Model the query OR INSERT USING THE  Query Builder! 👍🏽
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -å

      // Execute sql using the driver acquired graph.

      normalizedRecord = statement.values;
    } catch (err) {
      return exits.badConnection(err);
    }

    try {
      Helpers.query.processNativeRecord(normalizedRecord, WLModel, query.meta);
    } catch (error) {
      return exits.invalidDatastore(
        'Records could not math with your model attributes ',
      );
    }

    return exits.success({ record: normalizedRecord });
  },
});
