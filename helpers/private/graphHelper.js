const _ = require('@sailshq/lodash');
const Helpers = require('./');

module.exports = {
  constructGraph: async (manager, definitionsarray, exits) => {
    const { graph, graphEnabled } = manager;

    if (graphEnabled) {
      const graphInfo = await graph.get();

      const edgeDefinitions = (graphInfo.edgeDefinitions || []).map(
        ed => ed.collection,
      );

      const collections = await graph.listVertexCollections();
      const graphinfo = definitionsarray.map(
        model => new Promise(async (resolve) => {
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
              collection,
            );

            await Helpers.schema.buildIndexes(
              model.indexes,
              model.tableName,
              model,
              collection,
            );

            // Check Edge definitions in the edge
            const def = model.edgeDefinition || {};

            _.each(def.from, (f) => {
              const fromExists = _.includes(
                definitionsarray.map(d => d.tableName),
                f,
              );
              if (!fromExists) {
                return exits.error(
                  `\n\nThe edgeDefinitions for the ${model.tableName} are wrong. Model ${f} is not defined\n\n`,
                );
              }
            });

            _.each(def.to, (t) => {
              const toExists = _.includes(
                definitionsarray.map(d => d.tableName),
                t,
              );
              if (!toExists) {
                return exits.error(
                  `\n\nThe edgeDefinitions for the ${model.tableName} are wrong. Model ${t} is not defined\n\n`,
                );
              }
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
              console.log(`Error creating edge definition ${error}`);
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
            );

            await Helpers.schema.buildIndexes(
              model.indexes,
              model.tableName,
              model,
              collection,
            );

            if (!_.includes(collections, model.tableName)) {
              try {
                await graph.addVertexCollection(`${model.tableName}`);
              } catch (error) {
                console.log(
                  `Error adding vertex collection ${model.tableName} to graph ${error}`,
                );
              }
            }
          }
          return resolve(model);
        }),
      );

      await Promise.all(graphinfo);
    }
  },
};
