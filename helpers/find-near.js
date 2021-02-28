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

  fn: async function findNear(inputs, exits) {
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
        method: 'findNear',
        criteria: query.criteria,
        distanceCriteria: query.distanceCriteria,
      });
    } catch (error) {
      return exits.error(error);
    }

    const { dbConnection } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta
    );

    let cursor;
    try {
      // const collection = dbConnection.collection(`${statement.tableName}`);

      // const indexes = await collection.indexes();

      // const geoIndexes = (indexes || [])
      //   .filter(i => i.type === 'geo')
      //   .map(i => i.fields.reverse().map(f => `record.${f}`))

      // const geoJsonIndexes = (indexes || [])
      //   .filter(i => i.type === 'geo')
      //   .map(i => i.fields.reverse().map(f => `record.${f}`))
      //   .join(' , ');

      const { geoAttrName } = statement;

      let sql = `FOR record in ${statement.tableName} \n`;

      if (statement.letStatements) {
        sql = `${sql}${statement.letStatements} \n`;
      }

      if (statement.distanceCriteria) {
        sql = `${sql} let distance =  GEO_DISTANCE([${statement.distanceCriteria}], record.${geoAttrName}) sort distance ASC`;
      }

      if (statement.geoRadius > 0) {
        sql = `${sql} FILTER distance <= ${statement.geoRadius}`;
      }

      if (statement.sortClause) {
        sql = `${sql} SORT ${statement.sortClause}`;
      }

      if (statement.limit) {
        sql = `${sql} LIMIT ${statement.limit}`;
      }

      if (statement.select.length > 1) {
        sql = `${sql} return {${statement.select
          .map((f) => `${f}: record.${f}`)
          .join(' , ')}, distance: distance}`;
      }

      if (statement.select.length === 1) {
        sql = `${sql} return {record: record, distance: distance}`;
      }

      cursor = await dbConnection.query(`${sql}`);

      Helpers.connection.releaseConnection(dbConnection);
    } catch (error) {
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
    const selectRecords = cursor._result.map((r) => {
      const doc = r.record ? { ...r.record, distance: r.distance } : r;
      return global[`${WLModel.globalId}Object`].initialize(doc);
    });

    try {
      _.each(selectRecords, (nativeRecord) => {
        Helpers.query.processNativeRecord(nativeRecord, WLModel, query.meta);
      });
      return exits.success({ records: selectRecords });
    } catch (e) {
      return exits.error(e);
    }
  },
});
