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

module.exports = async function buildIndexes(
  indexes,
  tableName,
  definition,
  collection,
) {
  if (!definition || !tableName) {
    throw new Error('Build Schema/Table Name requires a valid definition.');
  }

  try {
    const indexfields = _.map(
      indexes,
      obj => new Promise(async (resolv) => {
        if (obj.fields) {
          await collection.createHashIndex(obj.fields, {
            unique: true,
            sparse: Boolean(obj.sparse),
          });
        }

        if (obj.geo) {
          await collection.createGeoIndex(obj.geo);
        }

        if (obj.geoJson) {
          await collection.createGeoIndex(obj.geoJson, { geoJson: true });
        }

        resolv();
      }),
    );

    return Promise.all(indexfields).then(() => true);
  } catch (error) {
    flaverr(
      {
        code: 'E_BULDING_INDEXES',
        message: `Could not build model indexes for ${tableName}`,
      },
      error,
    );
  }
  // Build up a string of column attributes

  return true;
};
