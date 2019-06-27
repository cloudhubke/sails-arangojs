const _ = require('@sailshq/lodash');
const Helpers = require('./');

module.exports = {
  constructGraph: async (manager, definitionsarray, exits) => {
    const { graph, graphEnabled } = manager;

    if (graphEnabled) {
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

            const fromExists = _.includes(
              definitionsarray.map(d => d.tableName),
              def.from,
            );
            const toExists = _.includes(
              definitionsarray.map(d => d.tableName),
              def.to,
            );

            if (!fromExists || !toExists) {
              return exits.error(
                `The edgeDefinitions for the ${model.tableName} are wrong`,
              );
            }

            // create edge definition

            try {
              if (!collectionExists) {
                await graph.addEdgeDefinition({
                  collection: `${model.tableName}`,
                  from: [`${def.from}`],
                  to: [`${def.to}`],
                });
              }
            } catch (error) {
              return exits.error(`Error creating edge definition${error}`);
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
              await graph.addVertexCollection(`${model.tableName}`);
            }
          }
          return resolve(model);
        }),
      );

      await Promise.all(graphinfo);
    }
  },
};
