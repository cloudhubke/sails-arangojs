//  ███████╗██╗   ██╗███╗   ███╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██╔════╝██║   ██║████╗ ████║    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ███████╗██║   ██║██╔████╔██║    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ╚════██║██║   ██║██║╚██╔╝██║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ███████║╚██████╔╝██║ ╚═╝ ██║    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//  ╚══════╝ ╚═════╝ ╚═╝     ╚═╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

module.exports = require('machine').build({
  friendlyName: 'FINDANY',

  description: 'Return the FINDANY of the records matched by the query.',

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
      description: 'Graph traversal in ANY direction.',
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

  fn: async function findAny(inputs, exits) {
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

    if (WLModel.classType !== 'Vertex') {
      return exits.badConnection(
        new Error(
          '\n\nThe this method can only be used in a model of type Vertex\n\n'
        )
      );
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
        method: 'findAny',
        criteria: query.criteria,
        edgeCollections: query.edgeCollections,
      });
    } catch (e) {
      return exits.error(e);
    }

    const { dbConnection, graph, graphName } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta
    );

    const where = statement.primarywhere || {};

    if (!graph && !statement.edgeCollections) {
      return exits.badConnection(
        new Error('The edgeCollections for findAny is null or undefined')
      );
    }

    if (!where._id) {
      return exits.badConnection(
        new Error(
          `Please provide the start vertex if ${pkColumnName} or _id for findAny is null or undefined`
        )
      );
    }

    let result;

    try {
      // Construct sql statement

      let sql = '';

      sql = `FOR vertex, edge, path IN ANY '${where._id}' ${
        statement.edgeCollections
          ? statement.edgeCollections
          : `GRAPH '${graphName}'`
      }`;

      if (statement.whereVertexClause || statement.whereEdgeClause) {
        const arr = [statement.whereVertexClause, statement.whereEdgeClause]
          .filter((a) => !!a)
          .join(' AND ');

        sql = `${sql} FILTER ${arr}`;
      }

      _.each(query.criteria, (value, key) => {
        if (key === 'limit' && statement.limit) {
          if (statement.skip) {
            if (statement.skip < 0) {
              statement.skip = statement.skip * -1;
            }

            sql = `${sql} LIMIT ${statement.skip}, ${statement.limit}`;
          } else {
            sql = `${sql} LIMIT ${statement.limit}`;
          }
        }

        if (key === 'sort' && statement.graphSort) {
          sql = `${sql} SORT ${statement.graphSort}`;
        }
      });

      sql = `${sql} RETURN {vertex, edge }`;

      result = await dbConnection.query(sql);

      Helpers.connection.releaseConnection(dbConnection);
    } catch (error) {
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }
      return exits.badConnection(error);
    }

    let newresult = await result.map(({ vertex, edge }) => ({
      vertex: vertex
        ? Helpers.query.processNativeRecord(vertex, WLModel, query.meta)
        : null,
      edge: edge
        ? Helpers.query.processNativeRecord(edge, WLModel, query.meta)
        : null,
    }));
    newresult = newresult.filter((r) => r.vertex !== null && r.edge !== null);

    return exits.success({ record: newresult });
  },
});
