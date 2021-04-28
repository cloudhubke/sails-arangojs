//  ███████╗██╗   ██╗███╗   ███╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██║   ██║████╗ ████║    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ███████╗██║   ██║██╔████╔██║    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ╚════██║██║   ██║██║╚██╔╝██║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ███████║╚██████╔╝██║ ╚═╝ ██║    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚══════╝ ╚═════╝ ╚═╝     ╚═╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'SUM',

  description: 'Return the SUM of the records matched by the query.',

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
      description: 'The results of the sum query.',
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
  },

  fn: async function sum(inputs, exits) {
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

    // Set a flag if a leased connection from outside the adapter was used or not.
    const leased = _.has(query.meta, 'leasedConnection');

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
        method: 'sum',
        criteria: query.criteria,
        numericAttrName: query.numericAttrName,
      });
    } catch (e) {
      return exits.error(e);
    }

    if (!statement.numericAttrName) {
      return exits.badConnection(
        new Error('The AttributeName for SUM in null or undefined')
      );
    }

    let session;
    let result;

    const { dbConnection } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta
    );

    try {
      const isarray = Array.isArray(query.numericAttrName);
      // Construct sql statement

      let sql = '';

      if (isarray) {
        sql = `FOR record in ${statement.tableName} \n`;

        if (statement.letStatements) {
          sql = `${sql}${statement.letStatements} \n`;
        }

        sql = `${sql} LET sum = ${statement.numericAttrName}`;
        sql = `${sql} LET doc = record`;
        sql = `${sql} RETURN {doc, sum }`;
      } else {
        sql = `FOR record IN ${statement.tableName}`;
        if (statement.whereClause) {
          sql = `${sql} FILTER ${statement.whereClause}`;
        }
        sql = `${sql} COLLECT AGGREGATE sum = SUM(record.${statement.numericAttrName})`;
        sql = `${sql} RETURN sum`;
      }
      const cursor = await dbConnection.query(sql);
      result = await cursor.all();

      if (isarray) {
        result = result.map((record) =>
          Helpers.query.processNativeRecord(
            { ...record.doc, sum: record.sum },
            WLModel
          )
        );
      } else {
        result = _.isArray(result) ? result[0] : 0;
      }

      Helpers.connection.releaseConnection(session, leased);
    } catch (error) {
      if (session) {
        Helpers.connection.releaseConnection(session, leased);
      }
      return exits.badConnection(error);
    }

    return exits.success(result);
  },
});
