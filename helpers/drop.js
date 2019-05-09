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
    let tableName;

    const WLModel = inputs.models[inputs.tableName];

    // Grab the pk column name (for use below)
    let pkColumnName;
    try {
      pkColumnName = WLModel.attributes[WLModel.primaryKey].columnName;
    } catch (e) {
      return exits.error(e);
    }

    let results;
    let session;
    try {
      session = await Helpers.connection.spawnOrLeaseConnection(
        inputs.datastore,
        inputs.meta,
      );
      //  ╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐  ┌┐┌┌─┐┌┬┐┌─┐
      //  ║╣ ╚═╗║  ╠═╣╠═╝║╣    │ ├─┤├┴┐│  ├┤   │││├─┤│││├┤
      //  ╚═╝╚═╝╚═╝╩ ╩╩  ╚═╝   ┴ ┴ ┴└─┘┴─┘└─┘  ┘└┘┴ ┴┴ ┴└─┘

      tableName = Helpers.schema.escapeTableName(inputs.tableName);
      const className = tableName.replace(/`/g, '');

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // Se cant DROP the entire class because this may  reorganize relationships.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // If the class exists, remove all class properties apart from pk, rid so as to recreate them afresh.
      // The PK field will be used to update, upsert data.
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // Get class properties to drop;
      const attributes = [];
      _.each(WLModel.attributes, (value, key) => {
        if (value.columnName !== pkColumnName) {
          attributes.push(value.columnName);
        }
      });

      // Determine whether the class exists in the database;

      const databaseclasses = await session.class.list();
      const classes = databaseclasses.map(c => c.name.toLowerCase());

      if (!_.includes(classes, className.toLowerCase())) {
        await Helpers.connection.releaseSession(session, leased);
        return exits.success();
      }

      const classinfo = await session.class.get(`${className}`);
      const classproperties = await classinfo.property.list();

      let properties = classproperties.map(p => p.name);

      // Begin a batch to delete properties
      let batch = '';
      _.each(properties, (property) => {
        batch = `${batch} DROP INDEX ${className}.${property} IF EXISTS;\n DROP PROPERTY ${className}.${property} FORCE;\n`;
      });

      // delete data apart from pk
      properties = classproperties
        .map(p => p.name)
        .filter(p => p !== pkColumnName);

      batch = `${batch}\nbegin;`;
      _.each(properties, (property) => {
        batch = `${batch} UPDATE ${className} REMOVE ${property};\n`;
      });

      batch = `${batch} commit;`;

      console.log('====================================');
      console.log(`DROP BATCH : ${className}`, batch);
      console.log('====================================');

      try {
        results = await session.batch(batch).all();
        console.log('====================================');
        console.log('RES : ', results);
        console.log('====================================');
        await Helpers.connection.releaseSession(session, leased);
      } catch (error) {
        if (session) {
          await Helpers.connection.releaseSession(session, leased);
        }
        if (error.code && (error.code === 5 || error.code === '5')) {
          // console.log(`Error while dropping ${tableName}`, error.code);
          console.log('====================================');
          console.log('ERRORR: ', error);
          console.log('====================================');
          return exits.success();
        }
        return exits.badConnection(`Error while dropping ${tableName}${error}`);
      }
      return exits.success();
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
