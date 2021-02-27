const _ = require('@sailshq/lodash');
const Helpers = require('./');
const validateSchema = require('./schema/validate-schema');
const ObjectMethods = require('./schema/ObjectMethods');

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
            let collection = await graph.vertexCollection(`${model.tableName}`);

            if (model.classType === 'Edge') {
              collection = graph.edgeCollection(`${model.tableName}`);

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
  },

  buildObjects: async function buildObjects(manager, definitionsarray, dsName) {
    try {
      const { graph, graphEnabled, dbConnection, Transaction } = manager;

      // if (dsName === 'foodchainer-instaveg') {
      //   console.log(Object.keys(sails.models));
      // }

      for (let model of definitionsarray) {
        if (
          !registeredObjectModels.includes(model.globalId) &&
          model.globalId &&
          model.ModelObjectConstructor
        ) {
          Object.assign(
            model.ModelObjectConstructor,
            ObjectMethods(model.globalId, model.keyProps, Boolean(model.cache))
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
};
