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
    // Dependencies
    const _ = require('@sailshq/lodash');
    const Helpers = require('./private');

    const { model } = inputs;

    if (!model.tableName) {
      return exits.error('TableName is not defined in the model.');
    }

    if (model.tableName !== inputs.tableName) {
      return exits.error(
        `Error in the definition of tableName property of the model associated with .${
          inputs.tableName
        }`,
      );
    }
    // Set a flag if a leased connection from outside the adapter was used or not.
    const leased = _.has(inputs.meta, 'leasedConnection');

    // Escape Table Name
    let tableName;
    let schema;
    let results;
    let session;
    try {
      //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
      //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
      //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
      // Spawn a new connection for running queries on.
      session = await Helpers.connection.spawnOrLeaseConnection(
        inputs.datastore,
        inputs.meta,
      );

      tableName = Helpers.schema.escapeTableName(inputs.tableName);
      schema = Helpers.schema.buildSchema(tableName, inputs.definition);

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // We are supposed to know whether the class exists in the db
      // If it does not, create it.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      const databaseclasses = await session.class.list();
      const classes = await databaseclasses.map(c => c.name);

      // Build Query

      let batch = '';
      if (_.includes(classes, tableName)) {
        // Determine whether we're creating Vertex, Edge or Just a document

        switch (model.classType) {
          case 'Document':
            batch = `CREATE CLASS ${Helpers.query.capitalize(tableName)};\n`;
            break;
          case 'Vertex':
            batch = `CREATE CLASS ${Helpers.query.capitalize(
              tableName,
            )} EXTENDS V;\n`;
            break;
          case 'Edge':
            batch = `CREATE CLASS ${Helpers.query.capitalize(
              tableName,
            )} EXTENDS E;\n`;
            break;
          default:
            return exits.error(
              `The classtype associated with model ${tableName} is not known. Should be one of Document/Vertex/Edge`,
            );
        }
      }

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // We should first find out if the cless exists.
      // If the class exists, remove all class properties apart from pk, rid so as to recreate them afresh.
      // The PK field will be used to update, upsert data.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      batch = `${batch} ${schema};`;

      // results = await session.batch(batch).all();

      console.log('====================================');
      console.log('BATCH : ', batch, results);
      console.log('====================================');

      Helpers.connection.releaseSession(session, leased);

      return exits.success(results);
    } catch (error) {
      console.log('====================================');
      console.log('SESSION ERROR: ', error);
      console.log('====================================');
      if (session) {
        Helpers.connection.releaseSession(session, leased);
      }
    }
  },
});
