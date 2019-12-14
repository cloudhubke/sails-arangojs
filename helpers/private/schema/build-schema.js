//  ██████╗ ██╗   ██╗██╗██╗     ██████╗     ███████╗ ██████╗██╗  ██╗███████╗███╗   ███╗ █████╗
//  ██╔══██╗██║   ██║██║██║     ██╔══██╗    ██╔════╝██╔════╝██║  ██║██╔════╝████╗ ████║██╔══██╗
//  ██████╔╝██║   ██║██║██║     ██║  ██║    ███████╗██║     ███████║█████╗  ██╔████╔██║███████║
//  ██╔══██╗██║   ██║██║██║     ██║  ██║    ╚════██║██║     ██╔══██║██╔══╝  ██║╚██╔╝██║██╔══██║
//  ██████╔╝╚██████╔╝██║███████╗██████╔╝    ███████║╚██████╗██║  ██║███████╗██║ ╚═╝ ██║██║  ██║
//  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
//
// Build a schema object that is suitable for using in a Create Table query.

const _ = require('@sailshq/lodash');
const flaverr = require('flaverr');

module.exports = async function buildSchema(tableName, definition, collection) {
  if (!definition || !tableName) {
    throw new Error('Build Schema/Table Name requires a valid definition.');
  }

  const pk = definition.primaryKey;
  let createdIndexes = [];

  if (_.isObject(definition) && !definition.attributes) {
    try {
      const indexes = _.map(
        definition,
        (attribute, name) => new Promise(async resolv => {
            const unique = Boolean(attribute.unique);
            // attribute.unique, allowNull, etc
            if (attribute && unique && !attribute.primaryKey) {
              await collection.createHashIndex(`${name}`, {
                unique: true,
                sparse: Boolean(!attribute.required),
              });
              resolv(`${name}`);
            }
            resolv('');
          })
      );

      createdIndexes = await Promise.all(indexes);
    } catch (error) {
      flaverr(
        {
          code: 'E_BULDING_INDEXES',
          message: `Could not build indexes for ${tableName}`,
        },
        error
      );
    }
  }

  try {
    const indexes = _.map(
      definition.attributes,
      (attribute, name) => new Promise(async resolv => {
          const autoMigrations = attribute.autoMigrations || {};
          const unique = Boolean(autoMigrations.unique);
          // attribute.unique, allowNull, etc
          if (attribute && unique && name !== pk) {
            await collection.createHashIndex(`${name}`, {
              unique: true,
              sparse: Boolean(!attribute.required),
            });
            resolv(`${name}`);
          }
          resolv('');
        })
    );

    createdIndexes = await Promise.all(indexes);
  } catch (error) {
    flaverr(
      {
        code: 'E_BULDING_INDEXES',
        message: `Could not build indexes for ${tableName}`,
      },
      error
    );
  }

  const modelIndexes = await collection.indexes();
  createdIndexes = createdIndexes.filter(i => !!i);

  // Delete indexes when they are removed from model
  const deleteindexes = modelIndexes.map(async fld => {
    if (fld.fields.length > 1) {
      return fld;
    }
    const indexfield = fld.fields.join('');

    if (indexfield === '_key') {
      return fld;
    }

    if (!createdIndexes.includes(indexfield)) {
      await collection.dropIndex(fld.id.split('/')[1]);
    }
    return fld;
  });

  await Promise.all(deleteindexes);

  // Build up a string of column attributes

  return true;
};
