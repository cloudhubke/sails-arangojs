//   ██████╗ ██████╗ ██╗   ██╗███╗   ██╗████████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔═══██╗██║   ██║████╗  ██║╚══██╔══╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║     ██║   ██║██║   ██║██╔██╗ ██║   ██║       ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║     ██║   ██║██║   ██║██║╚██╗██║   ██║       ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ╚██████╗╚██████╔╝╚██████╔╝██║ ╚████║   ██║       ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//   ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'Count',

  description: 'Return the count of the records matched by the query.',

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
      description: 'The results of the count query.',
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
  },

  fn: async function count(inputs, exits) {
    // Dependencies
    const Helpers = require('./private');

    // Store the Query input for easier access

    const { query, models } = inputs;
    query.meta = query.meta || {};

    // Find the model definition
    const WLModel = models[query.using];
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
        method: 'count',
        criteria: query.criteria,
      });
    } catch (e) {
      return exits.error(e);
    }

    let session;
    let result;

    const { dbConnection } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta,
    );

    try {
      let sql = `FOR record IN ${statement.tableName}`;
      if (statement.whereClause) {
        sql = `${sql} FILTER ${statement.whereClause}`;
      }
      sql = `${sql} COLLECT WITH COUNT INTO length`;
      sql = `${sql} RETURN length`;
      result = await dbConnection.query(sql);

      Helpers.connection.releaseConnection(session);
    } catch (error) {
      return exits.badConnection(error);
    }

    const len = result._result ? result._result[0] : 0;
    return exits.success(len);
  },
});
