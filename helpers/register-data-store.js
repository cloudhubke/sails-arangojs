//  ██████╗ ███████╗ ██████╗ ██╗███████╗████████╗███████╗██████╗
//  ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝╚══██╔══╝██╔════╝██╔══██╗
//  ██████╔╝█████╗  ██║  ███╗██║███████╗   ██║   █████╗  ██████╔╝
//  ██╔══██╗██╔══╝  ██║   ██║██║╚════██║   ██║   ██╔══╝  ██╔══██╗
//  ██║  ██║███████╗╚██████╔╝██║███████║   ██║   ███████╗██║  ██║
//  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
//
//  ██████╗  █████╗ ████████╗ █████╗     ███████╗████████╗ ██████╗ ██████╗ ███████╗
//  ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗    ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
//  ██║  ██║███████║   ██║   ███████║    ███████╗   ██║   ██║   ██║██████╔╝█████╗
//  ██║  ██║██╔══██║   ██║   ██╔══██║    ╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝
//  ██████╔╝██║  ██║   ██║   ██║  ██║    ███████║   ██║   ╚██████╔╝██║  ██║███████╗
//  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
//

String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

module.exports = require('machine').build({
  friendlyName: 'Register Data Store',

  description: 'Register a new datastore for making connections.',

  inputs: {
    identity: {
      description: 'A unique identitifer for the connection.',
      example: 'localPostgres',
      required: true,
    },

    config: {
      description: 'The configuration to use for the data store.',
      required: true,
      example: '===',
    },

    models: {
      description:
        'The Waterline models that will be used with this data store.',
      required: true,
      example: '===',
    },

    datastores: {
      description:
        'An object containing all of the data stores that have been registered.',
      required: true,
      example: '===',
    },

    modelDefinitions: {
      description:
        'An object containing all of the model definitions that have been registered.',
      required: true,
      example: '===',
    },
  },

  exits: {
    success: {
      description: 'The data store was initialized successfully.',
    },

    badConfiguration: {
      description: 'The configuration was invalid.',
      outputType: 'ref',
    },
    error: {
      description: 'An error registering data storer',
      outputType: 'ref',
    },
  },

  fn: async function registerDataStore(
    { datastores, identity, config, models, modelDefinitions },
    exits
  ) {
    // Dependencies
    const _ = require('@sailshq/lodash');
    const ArangoDb = require('../private/machinepack-arango');
    const graphHelper = require('./private/graphHelper');
    const StaticMethods = require('./private/schema/StaticMethods');
    // var Helpers = require('./private');

    // Validate that the datastore isn't already initialized
    if (datastores[identity]) {
      return exits.badConfiguration(
        new Error(`Datastore \`${identity}\` is already registered.`)
      );
    }

    //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌┐┌┌─┐┬┌─┐
    //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   │  │ ││││├┤ ││ ┬
    //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘└─┘┘└┘└  ┴└─┘
    // If a URL config value was not given, ensure that all the various pieces
    // needed to create one exist.
    const hasURL = Boolean(config.url);

    // Validate that the connection has a host and database property
    if (!hasURL && !config.host) {
      return exits.badConfiguration(
        new Error(`Datastore  \`${identity}\` config is missing a host value.`)
      );
    }

    if (!hasURL && !config.database) {
      return exits.badConfiguration(
        new Error(
          `Datastore  \`${identity}\` config is missing a value for the database name.`
        )
      );
    }

    let gIds = [];

    _.each(models, (modelinfo) => {
      let keyProps = modelinfo.keyProps || [];
      let modelDefaults = {};
      let modelAttributes = {};

      if (!modelinfo.globalId && modelinfo.tableName) {
        modelinfo.globalId = `${modelinfo.tableName}`.capitalize();
      }

      if (!modelinfo.globalId) {
        throw new Error(`Model globalId Error`);
      }
      gIds.push(modelinfo.globalId);

      for (let key in modelinfo.definition) {
        const autoMigrations = modelinfo.definition[key].autoMigrations || {};
        const unique = Boolean(autoMigrations.unique);
        const validations = modelinfo.definition[key].validations || {};
        const rules = modelinfo.definition[key].rules || {};

        if (_.has(modelinfo.definition[key], 'defaultsTo')) {
          modelDefaults[key] = modelinfo.definition[key].defaultsTo;
        }

        modelAttributes[key] = {
          type: modelinfo.definition[key].type,
          required: Boolean(
            modelinfo.definition[key].required ||
              _.has(modelinfo.definition[key], 'defaultsTo')
          ),
          rules,
        };

        if (validations.isIn && _.isArray(validations.isIn)) {
          modelAttributes[key].isIn = [...validations.isIn];
        }

        if (unique) {
          keyProps.push(key);
        }
      }

      modelinfo.modelAttributes = modelAttributes;
      modelinfo.modelDefaults = modelDefaults;
      modelinfo.keyProps = _.uniq(keyProps);
    });

    // TODO
    // Primary Key for ArangoDb models starts with _key insteat of id

    // Loop through every model assigned to the datastore we're registering,
    // and ensure that each one's primary key is either required or auto-incrementing.
    // try {
    //   _.each(models, (modelDef, modelIdentity) => {
    //     const primaryKeyAttr = modelDef.definition[modelDef.primaryKey];

    //     // Ensure that the model's primary key has either `autoIncrement` or `required`
    //     if (
    //       primaryKeyAttr.required !== true
    //       && (!primaryKeyAttr.autoMigrations
    //         || primaryKeyAttr.autoMigrations.autoIncrement !== true)
    //     ) {
    //       throw new Error(
    //         `In model \`${modelIdentity}\`, primary key \`${
    //           modelDef.primaryKey
    //         }\` must have either \`required\` or \`autoIncrement\` set.`,
    //       );
    //     }
    //   });
    // } catch (e) {
    //   return exits.badConfiguration(e);
    // }

    //  ╔═╗╦═╗╔═╗╔═╗╔╦╗╔═╗  ┌┬┐┌─┐┌┐┌┌─┐┌─┐┌─┐┬─┐
    //  ║  ╠╦╝║╣ ╠═╣ ║ ║╣   │││├─┤│││├─┤│ ┬├┤ ├┬┘
    //  ╚═╝╩╚═╚═╝╩ ╩ ╩ ╚═╝  ┴ ┴┴ ┴┘└┘┴ ┴└─┘└─┘┴└─
    // Build a "connection manager" -- an object that contains all of the state for this datastore.
    // This might be a MySQL connection pool, a Mongo client instance (`db`), or something even simpler.
    // For example, in sails-postgresql, `manager` encapsulates a connection pool that the stateless
    // `machinepack-postgresql` driver uses to communicate with the database.  The actual form of the
    // manager is completely dependent on this adapter.  In other words, it is custom and database-specific.
    // This is where you should store any custom metadata specific to this datastore.

    return ArangoDb.createManager({
      config,
      models,
      meta: _.omit(config, ['adapter', 'url', 'identity', 'schema']),
    }).switch({
      error(err) {
        return exits.error(
          `Consistency violation: Unexpected error creating db connection manager. ${`${config.url}`
            .split('/')
            .pop()} Details:\n\`\`\`\n${err}`
        );
      },
      malformed(report) {
        return exits.badConfiguration(
          `The given connection URL is not valid for this database adapter. ${`${config.url}`
            .split('/')
            .pop()}  Details:\n\`\`\`\n${report}`
        );
      },
      failed(report) {
        return exits.badConfiguration(
          `Failed to connect with the given datastore configuration. ${`${config.url}`
            .split('/')
            .pop()}  Details:\n\`\`\`\n${report}`
        );
      },
      success: async (report) => {
        try {
          const { manager } = report;

          //  ╔╦╗╦═╗╔═╗╔═╗╦╔═  ┌┬┐┌─┐  ┌─┐┌┐┌┌┬┐┬─┐┬ ┬
          //   ║ ╠╦╝╠═╣║  ╠╩╗   ││└─┐  ├┤ │││ │ ├┬┘└┬┘
          //   ╩ ╩╚═╩ ╩╚═╝╩ ╩  ─┴┘└─┘  └─┘┘└┘ ┴ ┴└─ ┴
          //  ┌─  ┌┬┐┌─┐┌┬┐┌─┐┌─┐┌┬┐┌─┐┬─┐┌─┐  ┌─┐┌┐┌┌┬┐┬─┐┬ ┬  ─┐
          //  │    ││├─┤ │ ├─┤└─┐ │ │ │├┬┘├┤   ├┤ │││ │ ├┬┘└┬┘   │
          //  └─  ─┴┘┴ ┴ ┴ ┴ ┴└─┘ ┴ └─┘┴└─└─┘  └─┘┘└┘ ┴ ┴└─ ┴   ─┘
          // Save information about the datastore to the `datastores` dictionary, keyed under
          // the datastore's unique name.  The information should itself be in the form of a
          // dictionary (plain JavaScript object), and have three keys:
          //
          // `manager`: The database-specific "connection manager" that we just built above.
          //
          // `config  : Configuration options for the datastore.  Should be passed straight through
          //            from what was provided as the `dsConfig` argument to this method.
          //
          // `driver` : Optional.  A reference to a stateless, underlying Node-Machine driver.
          //            (For instance `machinepack-postgresql` for the `sails-postgresql` adapter.)
          //            Note that this stateless, standardized driver will be merged into the main
          //            concept of an adapter in future versions of the Waterline adapter spec.
          //            (See https://github.com/node-machine/driver-interface for more informaiton.)
          //
          datastores[identity] = {
            config,
            manager,
            driver: ArangoDb,
            // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            // ^Note: In future releases, the driver and the adapter will simply become one thing.
            // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          };

          //  ╔╦╗╦═╗╔═╗╔═╗╦╔═  ┌─┐┬ ┬  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐
          //   ║ ╠╦╝╠═╣║  ╠╩╗  ├─┘├─┤  ││││ │ ││├┤ │  └─┐
          //   ╩ ╩╚═╩ ╩╚═╝╩ ╩  ┴  ┴ ┴  ┴ ┴└─┘─┴┘└─┘┴─┘└─┘
          // Also track physical models.
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          // FUTURE: Remove the need for this step by giving the adapter some kind of simpler access
          // to the orm instance, or an accessor function for models.
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

          const dbSchema = {};
          const definitionsarray = [];

          _.each(models, (modelinfo) => {
            // console.log('in datastore: `%s`  ……tracking physical model:  `%s` (tableName: `%s`)',datastoreName, phModelInfo.identity, phModelInfo.tableName);

            if (modelDefinitions[modelinfo.identity]) {
              throw new Error(
                `Consistency violation: Cannot register model: \`${modelinfo.identity}\`, because it is already registered with this adapter!  This could be due to an unexpected race condition in userland code (e.g. attempting to initialize multiple ORM instances at the same time), or it could be due to a bug in this adapter.  (If you get stumped, reach out at http://sailsjs.com/support.)`
              );
            }

            if (!modelinfo.classType) {
              throw new Error(
                `The classType must be defined in the model: \`${modelinfo.identity}\`, Please define a valid classTYpe for each model. Should be one of Vertex/Document/Edge  (If you get stumped, reach out at http://github.com/gaithoben/sails-arangojs.)`
              );
            }

            if (!modelinfo.globalId) {
              modelinfo.globalId = modelinfo.identity;
            }

            const definition = {
              indexes: modelinfo.indexes,
              schemaValidation: modelinfo.schemaValidation,
              additionalProperties: modelinfo.additionalProperties,
              classType: modelinfo.classType,
              tenantType: modelinfo.tenantType,
              primaryKey: modelinfo.primaryKey,
              attributes: modelinfo.definition,
              definition: modelinfo.definition,
              tableName: modelinfo.tableName,
              identity: modelinfo.identity,
              globalId: modelinfo.globalId,
              ModelObjectConstructor: modelinfo.ModelObjectConstructor,
              keyProps: modelinfo.keyProps,
              modelDefaults: modelinfo.modelDefaults,
              modelAttributes: modelinfo.modelAttributes,
              cache: modelinfo.cache,
            };

            const ModelObjectName = `${modelinfo.globalId}Object`;

            if (!global[ModelObjectName]) {
              global[ModelObjectName] = new Function(
                `return function ${ModelObjectName}(dsName){
                  if(dsName && dsName!=='default'){
                    let tenantcode = dsName;
                    Object.defineProperty(this, 'tenantcode', {
                      get: function(){
                        return tenantcode;
                      },
                      set: function (val) {
                        tenantcode=val;
                      }
                    })
                    Object.defineProperty(this, 'merchantcode', {
                      get: function(){
                        return tenantcode;
                      }
                    })
                  }
                };`
              )();

              Object.assign(
                global[ModelObjectName],
                StaticMethods({
                  globalId: modelinfo.globalId,
                  tableName: modelinfo.tableName,
                  keyProps: modelinfo.keyProps,
                  gIds,
                  modelDefaults: modelinfo.modelDefaults,
                  cache: Boolean(modelinfo.cache),
                })
              );

              definition.ModelObjectConstructor = global[ModelObjectName];
            }

            if (modelinfo.classType === 'Edge') {
              definition.edgeDefinition = modelinfo.edgeDefinition || {};
            }

            dbSchema[modelinfo.tableName] = definition;

            if (!config.tenantType) {
              config.tenantType = 'default';
            }

            if (modelinfo.tenantType.includes(config.tenantType)) {
              definitionsarray.push({ ...definition });
            }

            // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            // The below code would be unnecessary if `modelinfo.identity` were passed in the define method.
            // We need this in the define method so that we can get the classType for further definition.
            // So lets create schema with Key type `tableName` because its passed on define method
            // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

            // .log('\n\nphModelInfo:',util.inspect(phModelInfo,{depth:5}));
          }); // </each phModel>

          // We are going to create the graph vertices, edges and edgedefinitions

          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          // If auto build flag is true, construct the model collection
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

          const graph = await graphHelper.constructGraph(
            manager,
            definitionsarray,
            exits
          );

          modelDefinitions[identity] = dbSchema;

          if (config.sanitize) {
            graphHelper.sanitizeDb(manager, definitionsarray, identity, exits);
          }

          graphHelper.buildObjects(manager, definitionsarray, identity);

          graphHelper.afterRegister(manager, definitionsarray);

          if (config.onDbConnect && _.isFunction(config.onDbConnect)) {
            setTimeout(() => {
              config.onDbConnect(manager);
            }, 2000);
          }

          return exits.success({ datastores, modelDefinitions, config });
        } catch (e) {
          return exits.error(e);
        }
        // Inform Waterline that the datastore was registered successfully.
      }, // •-success>
    }); // createManager()>
  },
});
