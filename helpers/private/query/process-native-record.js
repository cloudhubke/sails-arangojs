/**
 * Module dependencies
 */

const assert = require('assert');
const _ = require('@sailshq/lodash');

/**
 * processNativeRecord()
 *
 * Modify a native record coming back from the database so that it matches
 * the expectations of the adapter spec (i.e. still a physical record, but
 * minus any database-specific eccentricities).
 *
 *
 * What do we do with @rid attribut of each record in orientDB?
 *
 * @param {Ref} nativeRecord
 * @param {Ref} WLModel
 * @param  {Dictionary?} meta       [`meta` query key from the s3q]
 */

module.exports = function processNativeRecord(
  nativeRecord,
  WLModel /* , meta */,
) {
  assert(!_.isUndefined(nativeRecord), '1st argument is required');
  assert(
    _.isObject(nativeRecord)
      && !_.isArray(nativeRecord)
      && !_.isFunction(nativeRecord),
    '1st argument must be a dictionary',
  );
  assert(!_.isUndefined(WLModel), '2nd argument is required');
  assert(
    _.isObject(nativeRecord)
      && !_.isArray(nativeRecord)
      && !_.isFunction(nativeRecord),
    '2nd argument must be a WLModel, and it has to have a `definition` property for this utility to work.',
  );

  // Grab the pk column name (for use below)
  let pkColumnName;
  try {
    pkColumnName = WLModel.attributes[WLModel.primaryKey].columnName;
  } catch (e) {
    throw new Error('NO PRIMARY KEY');
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Check whether the record has id and @rid properties.
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // if (_.isUndefined(nativeRecord.id) || !nativeRecord.id) {
  //   throw new Error(
  //     'The id field is required in the returned properties of a record'
  //   );
  // }

  nativeRecord[pkColumnName] = `${nativeRecord[pkColumnName]}`;
  // Delete fields unnecessary
  delete nativeRecord._rev;

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // FUTURE: if the nativeRecord does not have `@rid` or 'id, then throw a special error.
  // (This could be used to leave the decision of what to do entirely up to the
  // caller to  e.g. log a warning and add its index in the array to a list of records
  // that will be excluded from the results)
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Determine whether or not to use object ids.

  // Check out each known attribute...
  return nativeRecord;
};
