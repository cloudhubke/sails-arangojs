//  ██████╗ ██████╗  ██████╗ ██████╗
//  ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
//  ██║  ██║██████╔╝██║   ██║██████╔╝
//  ██║  ██║██╔══██╗██║   ██║██╔═══╝
//  ██████╔╝██║  ██║╚██████╔╝██║
//  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝
//

module.exports = require('machine').build({
  friendlyName: 'Drop',

  description: 'Remove a table from the database.',

  inputs: {
    datastore: {
      description: 'The datastore to use for connections.',
      extendedDescription:
        'Datastores represent the config and manager required to obtain an active database connection.',
      required: true,
      example: '===',
    },

    tableName: {
      description: 'The table name to modify',
      required: true,
      example: 'user',
    },

    models: {
      description:
        'The models in the datastore. We require this to extract the WLModel to modify',
      required: true,
      example: '===',
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
      description: 'The table was destroyed successfully.',
    },

    badConnection: {
      friendlyName: 'Bad connection',
      description:
        'A connection either could not be obtained or there was an error using the connection.',
    },
  },

  fn: async function drop(inputs, exits) {
    // Dependencies
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');

    // Set a flag if a leased connection from outside the adapter was used or not.
    const leased = _.has(inputs.meta, 'leasedConnection');

    const WLModel = inputs.models[inputs.tableName];

    let results;
    let session;
    try {
      const { dbConnection } = Helpers.connection.getConnection(
        inputs.datastore,
        inputs.meta
      );

      const { tableName } = inputs;

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // Se cant DROP the entire class because this may  reorganize relationships.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // If the class exists, remove all class properties apart from pk, rid so as to recreate them afresh.
      // The PK field will be used to update, upsert data.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // Find if the collection exists
      let collection = dbConnection.collection(`${tableName}`);
      if (WLModel.classType === 'Edge') {
        collection = dbConnection.edgeCollection(`${tableName}`);
      }

      const collectionExists = await collection.exists();

      if (collectionExists) {
        // const collectioninfo = await collection.get();
        // Drop it
        results = await collection.drop();
      }
      return exits.success(results);
    } catch (error) {
      if (session) {
        await Helpers.connection.releaseSession(session, leased);
      }
      return exits.badConnection(error);
    }
    //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
    //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    // Spawn a new connection to run the queries on.
  },
});
