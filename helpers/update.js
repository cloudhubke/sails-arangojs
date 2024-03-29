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
    .map((key) => `${key}:${stringify(obj_from_json[key])}`)
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
    let trx;
    let mergeObjects = true;

    //  ╔═╗╦═╗╔═╗  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
    //  ╠═╝╠╦╝║╣───╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  ├┬┘├┤ │  │ │├┬┘ ││└─┐
    //  ╩  ╩╚═╚═╝  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
    // Process each record to normalize output

    // Check if the pkField was set. This will avoid auto generation of new ids and deleting the key
    const criteria = query.criteria ? query.criteria.where || {} : {};
    // eslint-disable-next-line operator-linebreak
    let shouldUpdatePk =
      // eslint-disable-next-line operator-linebreak
      Boolean(query.valuesToSet[pkColumnName]) &&
      Boolean(criteria[pkColumnName]);

    shouldUpdatePk = false; //TO AVOID DELETION OF RECORDS

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

    if (_.has(query.meta, 'trx') && query.meta.trx) {
      trx = query.meta.trx;
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

    const { dbConnection, Transaction, dsName } =
      Helpers.connection.getConnection(inputs.datastore, query.meta);

    let session;
    let result;
    let updatedRecords = [];

    try {
      //  ╦═╗╦ ╦╔╗╔  ┬ ┬┌─┐┌┬┐┌─┐┌┬┐┌─┐  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
      //  ╠╦╝║ ║║║║  │ │├─┘ ││├─┤ │ ├┤   │─┼┐│ │├┤ ├┬┘└┬┘
      //  ╩╚═╚═╝╝╚╝  └─┘┴  ─┴┘┴ ┴ ┴ └─┘  └─┘└└─┘└─┘┴└─ ┴

      const updatevalues = `${statement.values}`.replace(/OLD\./g, 'record.');

      if (shouldUpdatePk) {
        // If Updating PK, remove record first, then reinsert
        const collection = dbConnection.collection(`${tableName}`);
        const oldrecord = await collection.document(
          `${criteria[pkColumnName]}`,
          {
            graceful: true,
          }
        );

        const trx = await dbConnection.beginTransaction({
          write: [`${tableName}`], // collection instances can be passed directly
        });

        try {
          if (oldrecord && oldrecord[pkColumnName]) {
            // remove the record
            await await trx.step(() =>
              collection.remove(`${criteria[pkColumnName]}`)
            );
          } else {
            throw new Error('The document does not exist');
          }

          const opts = { returnNew: fetchRecords };

          result = await await trx.step(() =>
            collection.save({ ...oldrecord, ...statement.valuesToSet }, opts)
          );

          if (fetchRecords) {
            updatedRecords = [result.new];
          }

          await trx.commit();
        } catch (error) {
          await trx.abort();
          throw error;
        }
      } else if (statement.primarywhere._id) {
        let sql = `LET record = DOCUMENT("${statement.primarywhere._id}")`;

        if (statement.letStatements) {
          sql = `${sql}${statement.letStatements} \n`;
        }

        sql = `${sql} UPDATE record WITH ${updatevalues} IN ${statement.tableName}`;

        sql = `${sql} OPTIONS { ignoreRevs: false, mergeObjects: ${
          mergeObjects ? 'true' : 'false'
        } }`;
        if (fetchRecords) {
          sql = `${sql} RETURN {new: NEW, old: OLD}`;
        }

        let cursor;
        if (trx) {
          cursor = await trx.step(() => dbConnection.query(sql));
        } else {
          cursor = await dbConnection.query(sql);
        }

        // result = await cursor.all();

        if (fetchRecords) {
          updatedRecords = await cursor.map((r) => r.new);
        }
      } else {
        let sql = `FOR record in ${statement.tableName} \n`;

        if (statement.letStatements) {
          sql = `${sql}${statement.letStatements} \n`;
        }

        if (statement.whereClause) {
          sql = `${sql} FILTER ${statement.whereClause}`;
        }
        sql = `${sql} UPDATE record WITH ${updatevalues} IN ${statement.tableName}`;
        sql = `${sql} OPTIONS { ignoreRevs: false, mergeObjects: ${
          mergeObjects ? 'true' : 'false'
        } }`;
        if (fetchRecords) {
          sql = `${sql} RETURN {new: NEW, old: OLD}`;
        }

        let cursor;
        if (trx) {
          cursor = await trx.step(() => dbConnection.query(sql));
        } else {
          cursor = await dbConnection.query(sql);
        }

        // result = await cursor.all();

        if (fetchRecords) {
          updatedRecords = await cursor.map((r) => r.new);
        }
      }
    } catch (error) {
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }

      const response = error.response || {};
      const errorData = response.data || response.body || {};

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

      return exits.error(new Error(error.toString()));
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
      let newrecords = await Promise.all(
        updatedRecords.map((record) =>
          global[`${WLModel.globalId}Object`].initialize(
            record,
            dsName,
            updatedRecords.length === 1
          )
        )
      );

      newrecords = newrecords.map(
        (record) =>
          // eslint-disable-next-line implicit-arrow-linebreak
          Helpers.query.processNativeRecord(record, WLModel, query.meta)
        // eslint-disable-next-line function-paren-newline
      );

      return exits.success({ records: newrecords });
    } catch (e) {
      if (session) {
        await Helpers.connection.releaseConnection(session);
      }
      return exits.error(e);
    }
  },
});
