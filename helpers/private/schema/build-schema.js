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

  try {
    const indexes = _.map(
      definition,
      (attribute, name) => new Promise(async (resolv) => {
        // attribute.unique, allowNull, etc
        if (attribute.unique && !attribute.primaryKey) {
          await collection.createHashIndex(`${name}`, { unique: true });
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
