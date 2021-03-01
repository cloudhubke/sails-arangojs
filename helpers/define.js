//  ██████╗ ███████╗███████╗██╗███╗   ██╗███████╗
//  ██╔══██╗██╔════╝██╔════╝██║████╗  ██║██╔════╝
//  ██║  ██║█████╗  █████╗  ██║██╔██╗ ██║█████╗
//  ██║  ██║██╔══╝  ██╔══╝  ██║██║╚██╗██║██╔══╝
//  ██████╔╝███████╗██║     ██║██║ ╚████║███████╗
//  ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═══╝╚══════╝
//

module.exports = require('machine').build({
  friendlyName: 'Define',

  description: 'Create a new table in the database based on a given schema.',

  inputs: {
    datastore: {
      description: 'The datastore to use for connections.',
      extendedDescription:
        'Datastores represent the config and manager required to obtain an active database connection.',
      required: true,
      example: '===',
    },

    tableName: {
      description: 'The name of the table to describe.',
      required: true,
      example: 'users',
    },

    definition: {
      description: 'The definition of the schema to build.',
      required: true,
      example: {},
    },

    model: {
      description:
        'The model definition associated with the schema we want to build.',
      required: true,
      example: {},
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'Additional stuff to pass to the driver.',
      extendedDescription:
        'This is reserved for custom driver-specific extensions.',
      example: '===',
    },
  },

  exits: {
    success: {
      description: 'The table was created successfully.',
    },

    badConnection: {
      friendlyName: 'Bad connection',
      description:
        'A connection either could not be obtained or there was an error using the connection.',
    },
  },

  fn: async function define(inputs, exits) {
    const Helpers = require('./private');

    const { model } = inputs;

    if (!model.tableName) {
      return exits.error('TableName is not defined in the model.');
    }

    if (model.tableName !== inputs.tableName) {
      return exits.error(
        `Error in the definition of tableName property of the model associated with .${inputs.tableName}`
      );
    }

    // const sleep = () => new Promise((resolve) => {
    //   setTimeout(() => {
    //     resolve();
    //   }, 50);
    // });

    // Escape Table Name
    const { tableName } = inputs;
    let result;

    const { dbConnection } = Helpers.connection.getConnection(
      inputs.datastore,
      inputs.meta
    );

    try {
      //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
      //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
      //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
      // Spawn a new connection for running queries on.

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // We are supposed to know whether the class exists in the db
      // If it does not, create it.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      let collection;
      let collectionExists;

      collection = dbConnection.collection(`${tableName}`);
      collectionExists = await collection.exists();

      if (collectionExists) {
        Helpers.connection.releaseConnection(dbConnection);
        return exits.success();
      }

      if (model.classType === 'Edge') {
        // Sleep for one second to allow vertices to create.

        //       await sleep();

        collection = dbConnection.edgeCollection(`${tableName}`);
        collectionExists = await collection.exists();

        if (collectionExists) {
          // Try recreating Indexes
          await Helpers.schema.buildSchema(
            tableName,
            inputs.definition,
            collection
          );
          await Helpers.schema.buildIndexes(
            inputs.indexes,
            tableName,
            inputs.definition,
            collection
          );

          Helpers.connection.releaseConnection(dbConnection);
          return exits.success();
        }

        // Look for edge definitions in the Edge model. If its not in there, register it.
      }

      // Create a collection because it does not exist;
      result = await collection.create();

      await Helpers.schema.buildSchema(
        tableName,
        inputs.definition,
        collection
      );

      await Helpers.schema.buildIndexes(
        inputs.indexes || inputs.model ? inputs.model.indexes : [],
        tableName,
        inputs.definition,
        collection
      );

      Helpers.connection.releaseConnection(dbConnection);

      return exits.success(result);
    } catch (error) {
      if (dbConnection) {
        Helpers.connection.releaseConnection(dbConnection);
      }
      return exits.error(error);
    }
  },
});
