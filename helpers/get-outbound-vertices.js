//  ███████╗██╗   ██╗███╗   ███╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██║   ██║████╗ ████║    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ███████╗██║   ██║██╔████╔██║    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ╚════██║██║   ██║██║╚██╔╝██║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ███████║╚██████╔╝██║ ╚═╝ ██║    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚══════╝ ╚═════╝ ╚═╝     ╚═╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'GETOUTBOUNDVERTICES',

  description:
    'Return the GETOUTBOUNDVERTICES of the records matched by the query.',

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

  fn: async function getOutboundVertices(inputs, exits) {
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

    let statement;
    try {
      statement = Helpers.query.compileStatement({
        pkColumnName,
        model: query.using,
        method: 'getOutboundVertices',
        criteria: query.criteria,
        edgeCollections: query.edgeCollections,
      });
    } catch (e) {
      return exits.error(e);
    }

    const where = statement.primarywhere || {};

    if (!statement.edgeCollections) {
      return exits.badConnection(
        new Error(
          'The edgeCollections for getOutboundVertices is null or undefined',
        ),
      );
    }

    if (!where._id) {
      return exits.badConnection(
        new Error(
          `Please provide the start vertex if ${pkColumnName} or _id for getOutboundVertices is null or undefined`,
        ),
      );
    }

    let result;

    const { dbConnection } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta,
    );

    try {
      // Construct sql statement

      let sql = '';

      sql = `FOR vertex, edge, path IN OUTBOUND '${where._id}' ${statement.edgeCollections}`;
      if (statement.whereVertexClause || statement.whereEdgeClause) {
        const arr = [statement.whereVertexClause, statement.whereEdgeClause]
          .filter(a => !!a)
          .join(' AND ');

        sql = `${sql} FILTER ${arr}`;
      }

      _.each(query.criteria, (value, key) => {
        if (key === 'limit' && statement.limit) {
          if (statement.skip) {
            sql = `${sql} LIMIT ${statement.skip}, ${statement.limit}`;
          } else {
            sql = `${sql} LIMIT ${statement.limit}`;
          }
        }

        if (key === 'sort' && statement.sortClause) {
          sql = `${sql} SORT ${statement.sortClause}`;
        }
      });

      sql = `${sql} RETURN {vertex, edge }`;

      result = await dbConnection.query(sql);

      result = result._result;

      Helpers.connection.releaseConnection(dbConnection);
    } catch (error) {
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }
      return exits.badConnection(error);
    }

    const newresult = result
      .map(({ vertex, edge }) => ({
        vertex: vertex
          ? Helpers.query.processNativeRecord(vertex, WLModel, query.meta)
          : null,
        edge: edge
          ? Helpers.query.processNativeRecord(edge, WLModel, query.meta)
          : null,
      }))
      .filter(r => r.vertex !== null && r.edge !== null);

    return exits.success({ record: newresult });
  },
});
