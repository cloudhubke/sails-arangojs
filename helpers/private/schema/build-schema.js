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

  try {
    const indexes = _.map(
      definition.attributes,
      (attribute, name) => new Promise(async (resolv) => {
          const autoMigrations = attribute.autoMigrations || {};
          const unique = Boolean(autoMigrations.unique);
          // attribute.unique, allowNull, etc
          if (attribute && unique && name !== pk) {
            await collection.createHashIndex(`${name}`, {
              unique: true,
              sparse: Boolean(!attribute.required),
            });
            resolv();
          }
          resolv();
        }),
    );

    return Promise.all(indexes).then(() => true);
  } catch (error) {
    flaverr(
      {
        code: 'E_BULDING_INDEXES',
        message: `Could not build indexes for ${tableName}`,
      },
      error,
    );
  }
  // Build up a string of column attributes

  return true;
};
