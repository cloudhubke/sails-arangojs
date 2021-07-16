//  ███████╗███████╗██╗     ███████╗ ██████╗████████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██╔════╝██║     ██╔════╝██╔════╝╚══██╔══╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ███████╗█████╗  ██║     █████╗  ██║        ██║       ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ╚════██║██╔══╝  ██║     ██╔══╝  ██║        ██║       ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ███████║███████╗███████╗███████╗╚██████╗   ██║       ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚══════╝╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝       ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'Find Records/Documents',

  description: 'Find record(s) in the database.',

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
      description: 'The results of the select query.',
      outputVariableName: 'records',
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

  fn: async function find(inputs, exits) {
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

    let trx;

    if (_.has(query.meta, 'trx') && query.meta.trx) {
      trx = query.meta.trx;
    }

    //  ╔═╗╔═╗╔╗╔╦  ╦╔═╗╦═╗╔╦╗  ┌┬┐┌─┐  ┌─┐┌┬┐┌─┐┌┬┐┌─┐┌┬┐┌─┐┌┐┌┌┬┐
    //  ║  ║ ║║║║╚╗╔╝║╣ ╠╦╝ ║    │ │ │  └─┐ │ ├─┤ │ ├┤ │││├┤ │││ │
    //  ╚═╝╚═╝╝╚╝ ╚╝ ╚═╝╩╚═ ╩    ┴ └─┘  └─┘ ┴ ┴ ┴ ┴ └─┘┴ ┴└─┘┘└┘ ┴
    // Convert the Waterline criteria into a Waterline Query Statement. This
    // turns it into something that is declarative and can be easily used to
    // build a SQL query.
    // See: https://github.com/treelinehq/waterline-query-docs for more info
    // on Waterline Query Statements.

    // // Compile the original Waterline Query

    let statement;

    try {
      statement = Helpers.query.compileStatement({
        pkColumnName,
        model: query.using,
        method: 'find',
        criteria: query.criteria,
      });
    } catch (error) {
      return exits.error(error);
    }

    const { dbConnection, dsName } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta
    );

    let cursor;
    try {
      //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
      //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
      //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
      //  ┌─┐┬─┐  ┬ ┬┌─┐┌─┐  ┬  ┌─┐┌─┐┌─┐┌─┐┌┬┐  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
      //  │ │├┬┘  │ │└─┐├┤   │  ├┤ ├─┤└─┐├┤  ││  │  │ │││││││├┤ │   │ ││ ││││
      //  └─┘┴└─  └─┘└─┘└─┘  ┴─┘└─┘┴ ┴└─┘└─┘─┴┘  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
      // Spawn a new connection for running queries on.

      // Execute sql using the driver acquired dbConnectio.
      let sql = `FOR record in ${statement.tableName} \n`;

      if (statement.letStatements) {
        sql = `${sql}${statement.letStatements} \n`;
      }

      _.each(query.criteria, (value, key) => {
        if (key === 'where' && statement.whereClause) {
          sql = `${sql}FILTER ${statement.whereClause} \n`;
        }

        if (key === 'sort' && statement.sortClause) {
          sql = `${sql} SORT ${statement.sortClause} \n`;
        }

        if (key === 'limit' && statement.limit) {
          if (statement.skip) {
            sql = `${sql} LIMIT ${statement.skip}, ${statement.limit} \n`;
          } else {
            sql = `${sql} LIMIT ${statement.limit} \n`;
          }
        }
      });

      const variables = _.keys(statement.let);

      if (statement.select.length > 1) {
        sql = `${sql} return { \n${statement.select
          .map((f) => `${f}: ${variables.includes(f) ? f : `record.${f}`}`)
          .join(', \n')} \n}`;
      } else {
        sql = `${sql} return record `;
      }

      if (trx) {
        cursor = await trx.step(() =>
          dbConnection.query(`${sql}`, {}, { count: true })
        );
      } else {
        cursor = await dbConnection.query(`${sql}`, {}, { count: true });
      }

      Helpers.connection.releaseConnection(dbConnection);
    } catch (error) {
      console.log('====================================');
      console.log('ERRR', error);
      console.log('====================================');
      if (error.code === 404) {
        return exits.success([]);
      }
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }
      return exits.badConnection(error);
    }

    // Refactor query function.

    //  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┌┐┌┌─┐┌┬┐┬┬  ┬┌─┐  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┌─┐─┐
    //  ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  │││├─┤ │ │└┐┌┘├┤   ├┬┘├┤ │  │ │├┬┘ │││ └─┐ │
    //  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┘└┘┴ ┴ ┴ ┴ └┘ └─┘  ┴└─└─┘└─┘└─┘┴└──┴┘└─└─┘─┘
    // Process records (mutate in-place) to wash away adapter-specific eccentricities.

    const metaOptions = {
      fireOnGetOne: true,
      ...query.meta,
    };

    try {
      let selectRecords = await cursor.map((doc) =>
        global[`${WLModel.globalId}Object`].initialize(
          doc,
          dsName,
          cursor.count === 1 && metaOptions.fireOnGetOne
        )
      );

      selectRecords = await Promise.all(selectRecords);

      _.each(selectRecords, (nativeRecord) => {
        Helpers.query.processNativeRecord(nativeRecord, WLModel, query.meta);
      });

      return exits.success({ records: selectRecords });
    } catch (e) {
      return exits.error(e);
    }
  },
});
