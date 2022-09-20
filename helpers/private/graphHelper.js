const _ = require('@sailshq/lodash');
const Helpers = require('./');
const validateSchema = require('./schema/validate-schema');
const StaticMethods = require('./schema/StaticMethods');
const PrototypeMethods = require('./schema/PrototypeMethods');
const ArangoReal = require('./connection/ArangoReal');
const EventSource = require('eventsource');

const sleep = (duration) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
};

let registeredObjectModels = [];

module.exports = {
  constructGraph: async (manager, definitionsarray, exits) => {
    try {
      const { graph, Transaction, graphEnabled, dsName } = manager;

      const collections = definitionsarray.map((def) => def.tableName);

      // if (!collections.includes('trash')) {
      //   console.log('====================================');
      //   console.log(
      //     `WARNING: trash collection is missing in ${
      //       dsName || 'default'
      //     } datastore`
      //   );
      //   console.log('====================================');
      // }

      if (graphEnabled) {
        const graphInfo = await graph.get();

        const edgeDefinitions = (graphInfo.edgeDefinitions || []).map(
          (ed) => ed.collection
        );

        const vertexcollections = await graph.listVertexCollections();

        for (let model of definitionsarray) {
          let vertexCollection = await graph.vertexCollection(
            `${model.tableName}`
          );

          let collection = vertexCollection.collection;

          if (model.classType === 'Edge') {
            const edgeCollection = graph.edgeCollection(`${model.tableName}`);
            collection = edgeCollection.collection;

            const collectionExists = await collection.exists();

            if (!collectionExists) {
              await collection.create({ type: 3 });
            }

            const dbcollection = await Transaction({
              action: function (params) {
                let collection;
                try {
                  collection = db._collection(`${params.collectionName}`);
                } catch (error) {}

                if (!collection) {
                  throw new Error(
                    `COLLECTION ${params.collectionName} not yet created`
                  );
                }
                return collection.type() === 3 ? 'edge' : 'vertex';
              },
              params: {
                collectionName: `${model.tableName}`,
              },
            });

            if (dbcollection !== 'edge') {
              throw new Error(
                `You must create an edge of ${model.tableName} first in ${dsName}`
              );
            }

            await Helpers.schema.buildSchema(
              model.tableName,
              model,
              collection,
              definitionsarray
            );

            await Helpers.schema.buildIndexes(
              model.indexes,
              model.tableName,
              model,
              collection
            );

            // Check Edge definitions in the edge
            const def = model.edgeDefinition || {};

            _.each(def.from, (f) => {
              const fromExists = _.includes(
                definitionsarray.map((d) => d.tableName),
                f
              );
              if (!fromExists) {
                throw new Error(
                  `\n\nThe edgeDefinitions for the ${model.tableName} are wrong. Model ${f} is not defined\n\n`
                );
              }
            });

            _.each(def.to, (t) => {
              const toExists = _.includes(
                definitionsarray.map((d) => d.tableName),
                t
              );
              if (!toExists) {
                throw new Error(
                  `\n\nThe edgeDefinitions for the ${model.tableName} are wrong. Model ${t} is not defined\n\n`
                );
              }
            });

            // create edge definition

            //// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            // remove vertext collection if exists
            // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            try {
              await graph.removeVertexCollection(`${model.tableName}`);
            } catch (error) {
              // do nothing
            }

            try {
              if (_.includes(edgeDefinitions, model.tableName)) {
                await graph.replaceEdgeDefinition({
                  collection: `${model.tableName}`,
                  from: def.from,
                  to: def.to,
                });
              } else {
                await graph.addEdgeDefinition({
                  collection: `${model.tableName}`,
                  from: def.from,
                  to: def.to,
                });
              }
            } catch (error) {
              // return exits.error(`Error creating edge definition${error}`);
              // console.log(`Error creating edge definition ${error}`);
            }
          } else {
            const collectionExists = await collection.exists();
            if (!collectionExists) {
              await collection.create();
            }

            await Helpers.schema.buildSchema(
              model.tableName,
              model,
              collection,
              definitionsarray
            );

            await Helpers.schema.buildIndexes(
              model.indexes,
              model.tableName,
              model,
              collection
            );

            // create edge definition

            //// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            // remove vertext collection if exists
            // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            try {
              await graph.removeVertexCollection(`${model.tableName}`);
            } catch (error) {
              // do nothing
            }

            if (!_.includes(vertexcollections, model.tableName)) {
              try {
                await graph.addVertexCollection(`${model.tableName}`);
              } catch (error) {
                // console.log(
                //   `Error adding vertex collection ${model.tableName} to graph ${error}`,
                // );
              }
            }
          }
        }
      }
      return true;
    } catch (error) {
      throw new Error(`Error creating graph ${error.toString()}`);
    }
  },

  buildObjects: function buildObjects({
    definitionsarray,
    gIds,
    modelsArray,
    manager,
  }) {
    try {
      // const { graph, graphEnabled, dbConnection, Transaction } = manager;

      for (let model of definitionsarray) {
        let keyProps = [...model.keyProps];

        for (let key in model.attributes) {
          const autoMigrations = model.attributes[key].autoMigrations || {};
          const unique = Boolean(autoMigrations.unique);

          if (unique) {
            keyProps.push(key);
          }
        }

        keyProps = _.uniq(keyProps);

        if (
          !registeredObjectModels.includes(model.globalId) &&
          model.globalId &&
          model.ModelObjectConstructor
        ) {
          const pkColumnName = model.attributes[model.primaryKey].columnName;

          const DefaultStaticMethods = StaticMethods({
            classType: model.classType,
            globalId: model.globalId,
            tableName: model.tableName,
            keyProps: keyProps,
            searchFields: model.searchFields || [],
            cache: Boolean(model.cache),
            gIds: gIds,
            modelsArray,
            tenantType: model.tenantType || [],
            datastores: [manager.dsName || 'admin'],
            modelDefaults: model.modelDefaults,
            modelAttributes: model.modelAttributes,
            Module: model.Module,
            EntityName: model.EntityName,
            pkColumnName,
            schema: model.schema,
          });

          const DefaultPrototypeMethods = PrototypeMethods(model.globalId);

          for (let m of Object.keys(model.ModelObjectConstructor)) {
            delete DefaultStaticMethods[m];
          }

          for (let m of Object.keys(model.ModelObjectConstructor.prototype)) {
            delete DefaultPrototypeMethods[m];
          }

          Object.assign(model.ModelObjectConstructor, DefaultStaticMethods);
          Object.assign(
            model.ModelObjectConstructor.prototype,
            DefaultPrototypeMethods
          );

          // console.log(`Checking`, model);

          registeredObjectModels.push(model.globalId);
        }

        if (
          model.ModelObjectConstructor &&
          !model.ModelObjectConstructor.datastores.includes(
            manager.dsName || 'admin'
          )
        ) {
          model.ModelObjectConstructor.datastores.push(
            manager.dsName || 'admin'
          );
        }
      }
    } catch (error) {
      console.log('OBJECTS ERROR');
      console.log('====================================');
      console.log(error.toString());
      console.log('====================================');
      throw error;
    }
  },

  sanitizeDb: async (manager, definitionsarray, dsName) => {
    const { Transaction } = manager;

    await sleep(2000);

    try {
      console.log(`Please wait as we try to check DB for Errors....`);
      console.log('====================================');
      for (let model of definitionsarray) {
        console.log(`Checking ${model.tableName}...`);

        const records = await Transaction({
          action: function ({ tableName }) {
            let aql = `
              let colschema = SCHEMA_GET("${tableName}")
            
              FOR rec in ${tableName}
                  let validation = SCHEMA_VALIDATE(rec, colschema)
                  FILTER validation.valid==false
                  RETURN {
                    rec,
                    colschema
                  }
              `;

            const result = db._query(aql);
            return result._documents;
          },
          writes: [],
          params: {
            tableName: model.tableName,
          },
        });

        const dsModel = sails.models[`_${model.tableName}`];

        if (records.length > 0) {
          console.log(`Found ${records.length} invalid records`);
        }
        for (let rec of records) {
          const {
            colschema,
            rec: { _key, _id, ...params },
          } = rec;

          const schema = (colschema || {}).rule;

          if (schema.properties) {
            const newprops = {};
            for (let prop in schema.properties) {
              const { linkCollections, validateLinks, ...otherprops } =
                schema.properties[prop];
              newprops[prop] = otherprops;
            }
            schema.properties = newprops;
          }

          try {
            let docParams = {};
            for (let key in params) {
              if (Boolean(params[key]) || typeof params[key] === 'boolean') {
                docParams[key] = params[key];
              }
            }

            normalized = await dsModel(dsName).normalize(docParams);
            normalized.createdAt =
              docParams.createdAt || normalized.createdAt || Date.now();
            normalized.updatedAt =
              docParams.updatedAt || normalized.updatedAt || Date.now();
            if (normalized.Timestamp) {
              normalized.Timestamp =
                docParams.Timestamp || normalized.Timestamp || Date.now();
            }

            const isValid = validateSchema(model, schema, {
              ...normalized,
              _key,
            });

            if (isValid) {
              await dsModel(dsName).updateOne({ id: _key }).set(normalized);
            }
          } catch (error) {
            if (error.toString().includes('Schema violation')) {
              throw new Error(
                `SCHEMA VALIDATION FAILED FOR DATASTORE ${dsName}`
              );
            } else {
              console.log(
                `Schema error for rec ${_key} in model ${model.tableName}`
              );
              console.log('====================================');
              console.log(error.toString());
            }
            throw new Error(`Error sanitizing model ${model.tableName}`);
          }
        }
      }

      return true;
    } catch (error) {
      console.log('SANITIZE ERROR');
      console.log('====================================');
      console.log(error.toString());
      console.log('====================================');
      throw error;
    }
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // After Datastore Initialization
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  afterRegister: async (manager, definitionsarray) => {
    try {
      const { dbConnection, dsName } = manager;

      const dbListener = new ArangoReal({
        db: dbConnection,
      });

      for (let model of definitionsarray) {
        dbListener.on(model.tableName, (doc, type) => {
          if (!model.ModelObjectConstructor) {
            return;
          }

          const docObj = model.ModelObjectConstructor.initialize(doc, dsName);

          if (
            typeof model.ModelObjectConstructor.prototype[type] === 'function'
          ) {
            docObj[type]();
          }

          if (type === 'onCreateOrUpdate') {
            if (
              doc.updatedAt &&
              typeof model.ModelObjectConstructor.prototype['onUpdate'] ===
                'function'
            ) {
              docObj.onUpdate();
            } else {
              if (
                typeof model.ModelObjectConstructor.prototype['onCreate'] ===
                'function'
              ) {
                docObj.onCreate();
              }
            }
          }

          if (type === 'onDelete') {
            if (
              typeof model.ModelObjectConstructor.prototype['onDelete'] ===
              'function'
            ) {
              return docObj.onDelete();
            }
          }
        });
      }

      for (let model of definitionsarray) {
        if (
          typeof model.ModelObjectConstructor.prototype['onGetOne'] ===
          'function'
        ) {
          const strFn = String(
            model.ModelObjectConstructor.prototype['onGetOne']
          );

          if (
            strFn.includes('getOne') ||
            strFn.includes('.onGetOne') ||
            strFn.includes('findOne') ||
            strFn.includes('getDocument') ||
            strFn.includes(`'onGetOne'`) ||
            strFn.includes(`"onGetOne"`)
          ) {
            const e = `\nInvalid function implementation onGetOne inside ${model.globalId}.
            The following functions cannot be called inside a ONGETONE(onGetOne) method:
            onGetOne
            getOne
            findOne
            getDocument                
            This is to avoid infinite loops. Consider using .findDocument\n`;

            console.log('====================================');
            console.log(e);
            console.log('====================================');
            throw new Error(e);
          }
        }

        const afterInitialize =
          model.ModelObjectConstructor.prototype.afterInitialize;
        if (typeof afterInitialize === 'function') {
          if (afterInitialize.constructor.name === 'AsyncFunction') {
            setTimeout(() => {
              console.log(
                `\n\n💥💥Its not advisable that 'afterInitialize' function in model ${model.globalId} should be async or should call other collections.💥💥\n\n`
              );
            }, 1000);
          }
        }
      }

      dbListener.start();
    } catch (error) {
      throw error;
    }
  },
};
