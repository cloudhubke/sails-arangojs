/* eslint-disable operator-linebreak */
//  ██╗   ██╗██████╗ ██████╗  █████╗ ████████╗███████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
//  ██║   ██║██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝██╔════╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
//  ██║   ██║██████╔╝██║  ██║███████║   ██║   █████╗      ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
//  ██║   ██║██╔═══╝ ██║  ██║██╔══██║   ██║   ██╔══╝      ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
//  ╚██████╔╝██║     ██████╔╝██║  ██║   ██║   ███████╗    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
//   ╚═════╝ ╚═╝     ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
//

// eslint-disable-next-line no-unused-vars
function stringify(obj_from_json) {
  if (typeof obj_from_json !== 'object' || Array.isArray(obj_from_json)) {
    // not an object, stringify using native function
    return JSON.stringify(obj_from_json);
  }
  // Implements recursive object serialization according to JSON spec
  // but without quotes around the keys.
  const props = Object.keys(obj_from_json)
    .map(key => `${key}:${stringify(obj_from_json[key])}`)
    .join(',');
  return `{${props}}`;
}

module.exports = require('machine').build({
  friendlyName: 'Update',

  description: 'Update record(s) in the database based on a query criteria.',

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
      description: 'The records were successfully updated.',
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

    notUnique: {
      friendlyName: 'Not Unique',
      outputType: 'ref',
    },
  },

  fn: async function update(inputs, exits) {
    // Dependencies
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');
    const flaverr = require('flaverr');

    const { query, models } = inputs;

    // Store the Query input for easier access
    query.meta = query.meta || {};

    // Find the model definition
    const WLModel = models[query.using];
    if (!WLModel) {
      return exits.invalidDatastore();
    }

    const tableName = query.using;

    // Grab the pk column name (for use below)
    let pkColumnName;
    try {
      pkColumnName = WLModel.attributes[WLModel.primaryKey].columnName;
    } catch (e) {
      return exits.error(e);
    }
    // Set a flag to determine if records are being returned
    let fetchRecords = false;
    let mergeObjects = true;

    //  ╔═╗╦═╗╔═╗  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
    //  ╠═╝╠╦╝║╣───╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  ├┬┘├┤ │  │ │├┬┘ ││└─┐
    //  ╩  ╩╚═╚═╝  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
    // Process each record to normalize output

    // Check if the pkField was set. This will avoid auto generation of new ids and deleting the key
    const criteria = query.criteria ? query.criteria.where || {} : {};
    const shouldUpdatePk =
      Boolean(query.valuesToSet[pkColumnName]) &&
      Boolean(criteria[pkColumnName]);

    try {
      Helpers.query.preProcessRecord({
        records: [query.valuesToSet],
        identity: WLModel.identity,
        model: WLModel,
      });

      if (!shouldUpdatePk) {
        delete query.valuesToSet[pkColumnName];
      }
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
        method: 'update',
        criteria: query.criteria,
        values: query.valuesToSet,
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

    if (_.has(query.meta, 'mergeObjects') && !query.meta.mergeObjects) {
      mergeObjects = false;
    }

    //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
    //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    //  ┌─┐┬─┐  ┬ ┬┌─┐┌─┐  ┬  ┌─┐┌─┐┌─┐┌─┐┌┬┐  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  │ │├┬┘  │ │└─┐├┤   │  ├┤ ├─┤└─┐├┤  ││  │  │ │││││││├┤ │   │ ││ ││││
    //  └─┘┴└─  └─┘└─┘└─┘  ┴─┘└─┘┴ ┴└─┘└─┘─┴┘  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    // Spawn a new connection for running queries on.

    const { dbConnection } = Helpers.connection.getConnection(
      inputs.datastore,
      query.meta
    );

    let session;
    let result;
    let updatedRecords = [];

    try {
      //  ╦═╗╦ ╦╔╗╔  ┬ ┬┌─┐┌┬┐┌─┐┌┬┐┌─┐  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
      //  ╠╦╝║ ║║║║  │ │├─┘ ││├─┤ │ ├┤   │─┼┐│ │├┤ ├┬┘└┬┘
      //  ╩╚═╚═╝╝╚╝  └─┘┴  ─┴┘┴ ┴ ┴ └─┘  └─┘└└─┘└─┘┴└─ ┴
      const updatevalues = `${statement.values}`.replace(/OLD/g, 'record');

      // eslint-disable-next-line no-console

      if (shouldUpdatePk) {
        // If Updating PK, remove record first, then reinsert
        const collection = dbConnection.collection(`${tableName}`);
        const oldrecord = await collection.document(
          `${criteria[pkColumnName]}`,
          {
            graceful: true,
          }
        );

        if (oldrecord && oldrecord[pkColumnName]) {
          // remove the record
          await collection.remove(`${criteria[pkColumnName]}`);
        } else {
          throw new Error('The document does not exist');
        }

        const opts = { returnNew: fetchRecords };

        result = await collection.save(
          { ...oldrecord, ...statement.valuesToSet },
          opts
        );

        if (fetchRecords) {
          updatedRecords = [result.new];
        }
      } else if (statement.primarywhere._id) {
        let sql = `LET record = DOCUMENT("${statement.primarywhere._id}")`;
        sql = `${sql} UPDATE record WITH ${updatevalues} IN ${statement.tableName}`;

        sql = `${sql} OPTIONS { ignoreRevs: false, ignoreErrors: true, mergeObjects: ${
          mergeObjects ? 'true' : 'false'
        } }`;
        if (fetchRecords) {
          sql = `${sql} RETURN {new: NEW, old: OLD}`;
        }

        result = await dbConnection.query(sql);

        if (fetchRecords) {
          updatedRecords = result._result.map(r => r.new);
        }
      } else {
        let sql = `FOR record IN ${statement.tableName}`;
        if (statement.whereClause) {
          sql = `${sql} FILTER ${statement.whereClause}`;
        }
        sql = `${sql} UPDATE record WITH ${updatevalues} IN ${statement.tableName}`;
        sql = `${sql} OPTIONS { ignoreRevs: false, ignoreErrors: true, mergeObjects: ${
          mergeObjects ? 'true' : 'false'
        } }`;
        if (fetchRecords) {
          sql = `${sql} RETURN {new: NEW, old: OLD}`;
        }
        result = await dbConnection.query(sql);

        if (fetchRecords) {
          updatedRecords = result._result.map(r => r.new);
        }
      }
    } catch (error) {
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }
      // eslint-disable-next-line no-console
      console.log('ERRRRRR', error);

      if (error.code === 409) {
        return exits.notUnique(
          flaverr(
            {
              name: 'update error',
              code: 'E_UNIQUE',
            },
            error
          )
        );
      }
      return exits.badConnection(error);
    }

    // If `fetch` is NOT enabled, we're done.
    if (!fetchRecords) {
      Helpers.connection.releaseConnection(dbConnection);
      return exits.success();
    } // -•

    // Otherwise, IWMIH we'll be sending back records:
    // ============================================

    //  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┌┐┌┌─┐┌┬┐┬┬  ┬┌─┐  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┌─┐─┐
    //  ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  │││├─┤ │ │└┐┌┘├┤   ├┬┘├┤ │  │ │├┬┘ │││ └─┐ │
    //  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┘└┘┴ ┴ ┴ ┴ └┘ └─┘  ┴└─└─┘└─┘└─┘┴└──┴┘└─└─┘─┘
    // Process record(s) (mutate in-place) to wash away adapter-specific eccentricities.

    try {
      await Helpers.connection.releaseConnection(dbConnection);
      const newrecords = updatedRecords.map(
        record =>
          // eslint-disable-next-line implicit-arrow-linebreak
          Helpers.query.processNativeRecord(record, WLModel, query.meta)
        // eslint-disable-next-line function-paren-newline
      );
      // Helpers.query.processNativeRecord(record.new, WLModel, query.meta);
      // Helpers.query.processNativeRecord(record.old, WLModel, query.meta);

      return exits.success({ records: newrecords });
    } catch (e) {
      if (session) {
        await Helpers.connection.releaseConnection(session);
      }
      return exits.error(e);
    }
  },
});
