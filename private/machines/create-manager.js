/* eslint-disable */
module.exports = {
  friendlyName: 'Create manager',

  description:
    'Build and initialize a connection manager instance (in Mongo, this is `db`).',

  moreInfoUrl:
    'https://github.com/node-machine/driver-interface/blob/master/machines/create-manager.js',

  inputs: {
    config: {
      description: 'The Arango Db Connection Object',
      example: '===',
      required: true,
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description:
        'A dictionary of additional options to pass in when instantiating the Mongo client instance. (e.g. `{ssl: true}`)',
      moreInfoUrl:
        'https://github.com/node-machine/driver-interface/blob/3f3a150ef4ece40dc0d105006e2766e81af23719/constants/meta.input.js',
      example: '===',
    },
  },

  exits: {
    success: {
      description: 'Connected to Mongo successfully.',
      outputFriendlyName: 'Report',
      outputDescription:
        'The `manager` property is a Mongo client instance.  The `meta` property is unused.',
      // outputExample: {
      //   manager: '===',
      //   meta: '==='
      // }
      outputExample: '===',
    },

    malformed: {
      description: 'The provided connection string is malformed.',
      extendedDescription:
        'The format of connection strings varies across different databases and their drivers. This exit indicates that the provided string is not valid as per the custom rules of this driver. Note that if this exit is traversed, it means the driver DID NOT ATTEMPT to create a manager-- instead the invalid connection string was discovered during a check performed beforehand.',
      outputFriendlyName: 'Report',
      outputDescription:
        'The `error` property is a JavaScript Error instance explaining that (and preferably "why") the provided connection string is invalid. The `meta` property is reserved for custom driver-specific extensions.',
      outputExample: {
        error: '===',
        meta: '===',
      },
    },

    failed: {
      description:
        'Could not connect to Mongo using the specified connection URL.',
      extendedDescription:
        'If this exit is called, it might mean any of the following:\n' +
        ' + the credentials encoded in the connection string are incorrect\n' +
        ' + there is no database server running at the provided host (i.e. even if it is just that the database process needs to be started)\n' +
        ' + there is no software "database" with the specified name running on the server\n' +
        ' + the provided connection string does not have necessary access rights for the specified software "database"\n' +
        ' + this Node.js process could not connect to the database, perhaps because of firewall/proxy settings\n' +
        ' + any other miscellaneous connection error\n' +
        '\n' +
        'Note that even if the database is unreachable, bad credentials are being used, etc, ' +
        'this exit will not necessarily be called-- that depends on the implementation of the driver ' +
        'and any special configuration passed to the `meta` input. e.g. if a pool is being used that spins up ' +
        'multiple connections immediately when the manager is created, then this exit will be called if any of ' +
        'those initial attempts fail. On the other hand, if the manager is designed to produce adhoc connections, ' +
        'any errors related to bad credentials, connectivity, etc. will not be caught until `getConnection()` is called.',
      outputFriendlyName: 'Report',
      outputDescription:
        'The `error` property is a JavaScript Error instance with more information and a stack trace. The `meta` property is reserved for custom driver-specific extensions.',
      outputExample: {
        error: '===',
        meta: '===',
      },
    },
  },

  async fn({ config /* meta */ }, exits) {
    const { Database, aql } = require('arangojs');

    const dbConnection = new Database({
      url: `http://${config.host}:${config.port || 8529}`,
    });
    dbConnection.useDatabase(`${config.database}`);
    dbConnection.useBasicAuth(`${config.user}`, `${config.password || ''}`);

    const createDatabase = async ({ rootPassword = '', dbName }) => {
      try {
        const db = new Database({
          url: `http://${config.host}:${config.port || 8529}`,
        });
        // db.useDatabase('_system');
        await db.createDatabase(dbName, [
          { username: 'root', password: rootPassword },
        ]);

        console.log('====================================');
        console.log(`Created db ${dbName}`);
        console.log('====================================');
      } catch (err) {
        console.log('====================================');
        console.log('DATABASE COULD NOT BE CREATED', err);
        console.log('====================================');
      }
    };

    try {
      // Check whether a graph exist. of Not, create the graph

      let graph;
      let graphName;

      if (config.graph) {
        graph = dbConnection.graph(`${config.database}`);
        graphName = `${config.database}`;

        const exists = await graph.exists();
        if (!exists) {
          // create graph
          await graph.create({
            edgeDefinitions: [],
          });
        }
      }

      // Transactions

      const Transaction = ({
        action = '',
        reads = [],
        writes = [],
        params = {},
        ...options
      }) => {
        const fanction = String(function (params) {
          // This code will be executed inside ArangoDB!

          const normalize = (data) => {
            data.id = data._key;
            delete data._rev;
            return data;
          };

          const _ = require('lodash');
          const db = require('@arangodb').db;
          const aql = require('@arangodb').aql;

          const dbServices = dbservices;

          const returnFunction = func;

          return returnFunction(params);
        });

        return dbConnection.executeTransaction(
          { read: [...reads], write: [...writes] },
          `${fanction}`
            .replace('dbservices', config.dbServices)
            .replace('func;', String(action)),
          { params, waitForSync: true, ...options }
        );
      };

      return exits.success({
        manager: {
          dbConnection,
          graphEnabled: config.graph,
          graph,
          graphName,
          aql,
          Transaction,
          createDatabase,
        },
        meta: config,
      });
    } catch (error) {
      return exits.failed(error);
    }
  },
};
