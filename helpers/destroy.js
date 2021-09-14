//
//  ██████╗ ███████╗███████╗████████╗██████╗  ██████╗ ██╗   ██╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗╚██╗ ██╔╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║  ██║█████╗  ███████╗   ██║   ██████╔╝██║   ██║ ╚████╔╝     ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║  ██║██╔══╝  ╚════██║   ██║   ██╔══██╗██║   ██║  ╚██╔╝      ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ██████╔╝███████╗███████║   ██║   ██║  ██║╚██████╔╝   ██║       ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝    ╚═╝       ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'Destroy',
  description: 'Destroy record(s) in the database matching a query criteria.',
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
      description: 'The results of the destroy query.',
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

  fn: async function destroy(inputs, exits) {
    // Dependencies
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');

    // Store the Query input for easier access
    const { query, models } = inputs;
    query.meta = query.meta || {};

    // Find the model definition
    const WLModel = models[query.using];
    if (!WLModel) {
      return exits.invalidDatastore();
    }

    // Set a flag if a leased connection from outside the adapter was used or not.
    const leased = _.has(query.meta, 'leasedConnection');

    // Set a flag to determine if records are being returned
    let fetchRecords = false;
    let trx;

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
        method: 'destroy',
        criteria: query.criteria,
      });
    } catch (e) {
      return exits.error(e);
    }

    const where = query.criteria.where || {};

    //  ╔╦╗╔═╗╔╦╗╔═╗╦═╗╔╦╗╦╔╗╔╔═╗  ┬ ┬┬ ┬┬┌─┐┬ ┬  ┬  ┬┌─┐┬  ┬ ┬┌─┐┌─┐
    //   ║║║╣  ║ ║╣ ╠╦╝║║║║║║║║╣   │││├─┤││  ├─┤  └┐┌┘├─┤│  │ │├┤ └─┐
    //  ═╩╝╚═╝ ╩ ╚═╝╩╚═╩ ╩╩╝╚╝╚═╝  └┴┘┴ ┴┴└─┘┴ ┴   └┘ ┴ ┴┴─┘└─┘└─┘└─┘
    //  ┌┬┐┌─┐  ┬─┐┌─┐┌┬┐┬ ┬┬─┐┌┐┌
    //   │ │ │  ├┬┘├┤  │ │ │├┬┘│││
    //   ┴ └─┘  ┴└─└─┘ ┴ └─┘┴└─┘└┘
    if (_.has(query.meta, 'fetch') && query.meta.fetch) {
      fetchRecords = true;
    }

    if (_.has(query.meta, 'trx') && query.meta.trx) {
      trx = query.meta.trx;
    }

    //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
    //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    //  ┌─┐┬─┐  ┬ ┬┌─┐┌─┐  ┬  ┌─┐┌─┐┌─┐┌─┐┌┬┐  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  │ │├┬┘  │ │└─┐├┤   │  ├┤ ├─┤└─┐├┤  ││  │  │ │││││││├┤ │   │ ││ ││││
    //  └─┘┴└─  └─┘└─┘└─┘  ┴─┘└─┘┴ ┴└─┘└─┘─┴┘  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    // Spawn a new connection for running queries on.

    let session;
    let result;
    let removedRecords = [];

    const {
      dbConnection,
      aql,
      graph,
      graphCollections,
      graphEnabled,
      dsName,
      edges,
    } = Helpers.connection.getConnection(inputs.datastore, query.meta);

    let collections = [];
    let collection;

    if (graphEnabled) {
      collections = graphCollections;
    }

    try {
      // Check if collection exists

      if (_.includes(collections, statement.tableName)) {
        // This is a graph member! Collection  must be removed via key

        const vertexCollection = graph.vertexCollection(
          `${statement.tableName}`
        );
        collection = vertexCollection.collection;

        if (WLModel.classType === 'Edge') {
          const edgeCollection = graph.edgeCollection(`${statement.tableName}`);
          collection = edgeCollection.collection;
        }

        let ids = where[pkColumnName];

        if (_.isString(ids)) {
          ids = [ids];
        }

        if (_.isObject(ids) && (_.has('$in') || _.has('in'))) {
          ids = ids.in || ids.$in;
        }

        if (!ids || _.isEmpty(ids)) {
          return exits.badConnection(
            new Error(
              `Please provide the ${statement.tableName}'s ${pkColumnName} or _id for destroy function. It is null or undefined`
            )
          );
        }

        let cursor;
        if (trx) {
          cursor = await trx.step(() =>
            collection.removeAll(ids, {
              returnOld: fetchRecords || global._Deleted,
            })
          );
        } else {
          cursor = await collection.removeAll(ids, {
            returnOld: fetchRecords || global._Deleted,
          });
        }

        if (fetchRecords || global._Deleted) {
          removedRecords = await cursor.map((doc) =>
            global[`${WLModel.globalId}Object`].initialize(doc, dsName, false)
          );

          if (global._Deleted) {
            await _Deleted(dsName).create({
              ids,
              Documents: removedRecords,
              Timestamp: Date.now(),
            });
          }
        }
      } else {
        let sql = `FOR record in ${statement.tableName}`;

        if (statement.whereClause) {
          sql = `${sql} FILTER ${statement.whereClause}`;
        }

        sql = `${sql} REMOVE record in ${statement.tableName}`;

        if (fetchRecords || global._Deleted) {
          sql = `${sql}  LET removed = OLD RETURN removed`;
        }

        let cursor;
        if (trx) {
          cursor = await trx.step(() => dbConnection.query(sql));
        } else {
          cursor = await dbConnection.query(sql);
        }

        if (fetchRecords || global._Deleted) {
          removedRecords = await cursor.map((doc) =>
            global[`${WLModel.globalId}Object`].initialize(doc, dsName, false)
          );

          if (global._Deleted) {
            await _Deleted(dsName).create({
              ids: removedRecords.map((doc) => doc[pkColumnName]),
              Documents: removedRecords,
              Timestamp: Date.now(),
            });
          }
        }
      }

      Helpers.connection.releaseConnection(session, leased);
    } catch (error) {
      if (session) {
        await Helpers.connection.releaseConnection(session, leased);
      }

      return exits.error(error);
    }

    if (!fetchRecords) {
      return exits.success();
    }

    try {
      _.each(removedRecords, (nativeRecord) => {
        Helpers.query.processNativeRecord(nativeRecord, WLModel, query.meta);
      });
    } catch (e) {
      return exits.error(e);
    }
    return exits.success({ records: removedRecords });
  },
});
