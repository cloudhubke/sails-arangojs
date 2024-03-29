const dbmodules = require('./dbmodules');
const SqlString = require('sqlstring');
const DbObject = require('./DbObject');

String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

/* eslint-disable */
module.exports = {
  friendlyName: 'Create manager',

  description:
    'Build and initialize a connection manager instance (in Arango, this is `db`).',

  moreInfoUrl:
    'https://github.com/node-machine/driver-interface/blob/master/machines/create-manager.js',

  inputs: {
    config: {
      description: 'The Arango Db Connection Object',
      example: '===',
      required: true,
    },

    models: {
      description: 'The models defined for the db connection',
      example: '===',
      required: true,
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description:
        'A dictionary of additional options to pass in when instantiating the Arango client instance. (e.g. `{ssl: true}`)',
      moreInfoUrl:
        'https://github.com/node-machine/driver-interface/blob/3f3a150ef4ece40dc0d105006e2766e81af23719/constants/meta.input.js',
      example: '===',
    },
  },

  exits: {
    success: {
      description: 'Connected to Arango successfully.',
      outputFriendlyName: 'Report',
      outputDescription:
        'The `manager` property is a Arango client instance.  The `meta` property is unused.',
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
        'Could not connect to Arango using the specified connection URL.',
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

  async fn({ config, models /* meta */ }, exits) {
    const { Database, aql } = require('arangojs');
    const _ = require('@sailshq/lodash');

    const modelCases = () => {
      let caseStr = '';
      _.each(models, (model) => {
        caseStr = `${caseStr}case '${model.globalId}': {\nreturn ${model.globalId}Dbo.getDocument({_id})\n}\n\n`;
      });
      return caseStr;
    };

    let getDocument = `
        String.prototype.capitalize = function () {
          return this.charAt(0).toUpperCase() + this.slice(1);
        };
        const getDocument = function(searchValue){

          let _id = '';

          if (_.isString(searchValue) && searchValue.includes('/')) {
            _id = searchValue;
          }
    
          if (
            _.isObject(searchValue) &&
            searchValue._id &&
            searchValue._id.includes('/')
          ) {
            _id = searchValue._id;
          }
    
          if (!_id) {
            throw new Error('_id attribute should either be an object or a string. Found: ' + JSON.stringify(searchValue) );
          }

          let coll=_id.split('/')[0].capitalize();

          try {
            switch (coll) {
              ${modelCases()}          
              default: {
                throw new Error('getDocument could not find document ' + _id);
              }
            }
          } catch (error) {
            throw new Error('getDocument could not find document ' + _id + ': ' + error.toString());
          }
        }
    `;

    let dbObjects = `${getDocument}\n\n`;
    let deleteDbObjects = '';
    let collections = [];
    let globalIds = [];
    let dbos = [];
    let vertices = [];
    let edges = [];
    let url = `http://${config.host}:${config.port || 8529}`;

    _.each(models, (model) => {
      const tenant = config.tenantType || 'default';

      if (model.tenantType.includes(tenant) && global[`${model.globalId}Dbo`]) {
        dbos.push(`${model.globalId}Dbo`);
        collections.push(model.tableName);
        globalIds.push(model.globalId);

        if (model.classType == 'edge') {
          edges.push(global[`${model.globalId}Object`]);
        } else {
          vertices.push(global[`${model.globalId}Object`]);
        }
      }

      if (model.tenantType.includes(tenant) && global[`${model.globalId}Dbo`]) {
        dbObjects = `${dbObjects}${DbObject(model)}\n\n`;
        deleteDbObjects = `${deleteDbObjects}
        ${model.globalId}Dbo = null;
        \n`;
      }
    });

    const dbConnection = new Database({
      url,
    });

    dbConnection.useDatabase(`${config.database}`);
    dbConnection.useBasicAuth(`${config.user}`, `${config.password || ''}`);

    const createDatabase = async ({ rootPassword = '', dbName }) => {
      try {
        const db = new Database({
          url: `http://${config.host}:${config.port || 8529}`,
        });
        // db.useDatabase('_system');

        db.useDatabase('_system');
        db.useBasicAuth('root', rootPassword);

        await db.createDatabase(dbName);

        console.log('====================================');
        console.log(`Created db ${dbName}`);
        console.log('====================================');
      } catch (err) {
        throw new Error(err);
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
          await graph.create([]);
        }
      }

      // Generate a token for foxx services requests

      const authaction = String(function (params) {
        // This code will be executed inside ArangoDB!
        const request = require('@arangodb/request');
        const db = require('@arangodb').db;

        const response = request({
          method: 'post',
          url: `/_db/${db._name()}/_open/auth`,
          body: {
            username: params.username,
            password: params.password || '',
          },
          json: true,
        });

        const body = response.json || {};

        return `${body.jwt}`;
      });

      const bearerToken = await dbConnection.executeTransaction(
        { read: [], write: [] },
        authaction,
        {
          params: { username: config.user, password: config.password },
        }
      );

      // Transactions

      let SystemSettings = {};

      const updateSystemSettings = (settings = {}) => {
        SystemSettings = {
          ...settings,
        };
      };

      const getSystemSettings = () => {
        return { ...SystemSettings };
      };

      const Transaction = ({
        action = '',
        reads = [],
        writes = [],
        params = {},
        ...options
      }) => {
        const fanction = String(function (params) {
          // This code will be executed inside ArangoDB!

          const _ = require('lodash');
          const db = require('@arangodb').db;
          const aql = require('@arangodb').aql;
          const queues = require('@arangodb/foxx/queues');
          const arangoRequest = require('@arangodb/request');

          try {
            bearerToken; //1
            let request = (options) => {
              const requestOptions = Object.assign(options, {
                auth: { bearer: bearerToken },
              });

              return arangoRequest(requestOptions);
            };

            dbmodules; //2

            const normalize = (data) => {
              data.id = data._key;
              delete data._rev;
              return data;
            };

            SystemSettings; //3

            let dbServices = dbservices; //4
            if (
              dbServices &&
              dbServices.globals &&
              typeof dbServices.globals === 'function'
            ) {
              dbServices.globals();
            }

            dbObjects; //5

            let returnFunction = func; //6

            const txResult = returnFunction(params);

            request = null;
            dbServices = null;
            returnFunction = null;
            deleteDbObjects; //7

            return txResult;
          } catch (error) {
            throw new Error(
              `TX ERROR \n ${JSON.stringify(error.toString())}`
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
            );
          }
        });

        if (
          dbObjects.includes('async') ||
          dbObjects.includes('await') ||
          dbObjects.includes('Promise')
        ) {
          throw new Error(
            `Invalid code in dbobjects folder. Async functions are not allowed.`
          );
        }

        let actionStr = `${fanction}`
          .replace('dbmodules', '?')
          .replace('dbservices', '?')
          .replace('dbObjects', '?')
          .replace('func;', '?')
          .replace('bearerToken;', '?')
          .replace('SystemSettings;', '?')
          .replace('deleteDbObjects;', '?');

        actionStr = SqlString.format(actionStr, [
          SqlString.raw(`const bearerToken = '${bearerToken}';`),
          SqlString.raw(dbmodules),
          SqlString.raw(
            `const SystemSettings = ${JSON.stringify(getSystemSettings())};`
          ),
          SqlString.raw(config.dbServices || '{}'),
          SqlString.raw(dbObjects || ''),
          SqlString.raw(String(action)),
          SqlString.raw(deleteDbObjects),
        ]);

        return dbConnection.executeTransaction(
          {
            read: _.uniq([...reads, '_jobs']),
            write: _.uniq([...writes, '_jobs']),
          },
          actionStr,
          // .replace('dbmodules;', dbmodules)

          {
            params: {
              ...params,
            },
            waitForSync: true,
            ...options,
          }
        );
      };

      let graphCollections = [];

      if (config.graph) {
        const vertexCollections = await graph.listVertexCollections();
        const edgeCollections = await graph.listEdgeCollections();
        graphCollections = [...vertexCollections, ...edgeCollections];
      }

      async function cleanDatastore() {
        const graph = dbConnection.graph(`${config.database}`);
        const graphName = `${config.database}`;

        const exists = await graph.exists();

        if (exists) {
          await graph.drop();
        }

        let dbcollections = await dbConnection.collections();
        dbcollections = dbcollections.map((collection) => collection._name);
        const dsName =
          config.identity === 'default' ? undefined : config.identity;

        for (const dbcollection of dbcollections) {
          const coll = dbConnection.collection(dbcollection);
          const exists = await coll.exists();

          if (exists && !collections.includes(dbcollection)) {
            console.log('dropping collection', dbcollection, ' in ', dsName);

            await coll.drop();
          }
        }
      }

      return exits.success({
        manager: {
          dbConnection,
          createDatabase,
          graphEnabled: config.graph,
          graph,
          graphCollections,
          collections,
          globalIds,
          graphName,
          aql,
          Transaction,
          SystemSettings,
          getSystemSettings,
          updateSystemSettings,
          cleanDatastore,
          dsName: config.identity === 'default' ? undefined : config.identity,
          tenantType: config.tenantType || 'admin',
          url,
          config,
          vertices,
          bearerToken,
          edges,
        },
        meta: config,
      });
    } catch (error) {
      return exits.failed(error);
    }
  },
};
