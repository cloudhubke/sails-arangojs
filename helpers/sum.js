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
        new Error('The AttributeName for SUM in null or undefined'),
      );
    }

    let session;
    let result;

    try {
      session = await Helpers.connection.spawnOrLeaseConnection(
        inputs.datastore,
        query.meta,
      );

      const isarray = Array.isArray(query.numericAttrName);
      // Construct sql statement

      let sql = '';

      if (isarray) {
        sql = `select ${statement.selectClause} sum(${
          statement.numericAttrName
        }) as sum from ${Helpers.query.capitalize(statement.from)} where ${
          statement.whereClause
        }`;
      } else {
        sql = `select sum(${
          statement.numericAttrName
        }) as sum from ${Helpers.query.capitalize(statement.from)} where ${
          statement.whereClause
        }`;
      }

      const deffered = session.query(sql);
      if (isarray) {
        result = await deffered.all();
      } else {
        result = await deffered.one();
        result = result.sum || 0;
      }

      await Helpers.connection.releaseSession(session, leased);
    } catch (error) {
      if (session) {
        await Helpers.connection.releaseSession(session, leased);
      }
      return exits.badConnection(error);
    }

    return exits.success(result);
  },
});
