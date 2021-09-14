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
      const { graph, graphEnabled } = manager;

      if (graphEnabled) {
        const graphInfo = await graph.get();

        const edgeDefinitions = (graphInfo.edgeDefinitions || []).map(
          (ed) => ed.collection
        );

        const collections = await graph.listVertexCollections();

        const graphinfo = definitionsarray.map(
          (model) =>
            new Promise(async (resolve) => {
              let vertexCollection = await graph.vertexCollection(
                `${model.tableName}`
              );
              let collection = vertexCollection.collection;

              if (model.classType === 'Edge') {
                const edgeCollection = graph.edgeCollection(
                  `${model.tableName}`
                );
                collection = edgeCollection.collection;

                const collectionExists = await collection.exists();

                if (!collectionExists) {
                  await collection.create({ type: 3 });
                }

                await Helpers.schema.buildSchema(
                  model.tableName,
                  model,
                  collection
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
                    return exits.error(
                      `\n\nThe edgeDefinitions for the ${model.tableName} are wrong. Model ${f} is not defined\n\n`
                    );
                  }
                  return true;
                });

                _.each(def.to, (t) => {
                  const toExists = _.includes(
                    definitionsarray.map((d) => d.tableName),
                    t
                  );
                  if (!toExists) {
                    return exits.error(
                      `\n\nThe edgeDefinitions for the ${model.tableName} are wrong. Model ${t} is not defined\n\n`
                    );
                  }
                  return true;
                });

                // create edge definition

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
                  collection
                );

                await Helpers.schema.buildIndexes(
                  model.indexes,
                  model.tableName,
                  model,
                  collection
                );

                if (!_.includes(collections, model.tableName)) {
                  try {
                    await graph.addVertexCollection(`${model.tableName}`);
                  } catch (error) {
                    // console.log(
                    //   `Error adding vertex collection ${model.tableName} to graph ${error}`,
                    // );
                  }
                }
              }
              return resolve(model);
            })
        );

        await Promise.all(graphinfo);
        return true;
      }
      return true;
    } catch (error) {
      return exits.error(error.toString);
    }
  },

  buildObjects: function buildObjects(manager, definitionsarray, dsName) {
    try {
      const { graph, graphEnabled, dbConnection, Transaction } = manager;

      let gIds = [];

      for (let model of definitionsarray) {
        gIds.push(model.globalId);
      }

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
          const DefaultStaticMethods = StaticMethods({
            globalId: model.globalId,
            tableName: model.tableName,
            keyProps: keyProps,
            cache: Boolean(model.cache),
            gIds: gIds,
            modelDefaults: model.modelDefaults,
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
    const { graph, graphEnabled, dbConnection, Transaction } = manager;

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
      const { dbConnection, dsName, config, url, bearerToken } = manager;

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

            if (
              typeof model.ModelObjectConstructor.prototype['onDestroy'] ===
              'function'
            ) {
              return docObj.onDestroy();
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
      }

      dbListener.start();
    } catch (error) {
      throw error;
    }
  },
};
