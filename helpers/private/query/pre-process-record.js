//  ██████╗ ██████╗ ███████╗    ██████╗ ██████╗  ██████╗  ██████╗███████╗███████╗███████╗
//  ██╔══██╗██╔══██╗██╔════╝    ██╔══██╗██╔══██╗██╔═══██╗██╔════╝██╔════╝██╔════╝██╔════╝
//  ██████╔╝██████╔╝█████╗█████╗██████╔╝██████╔╝██║   ██║██║     █████╗  ███████╗███████╗
//  ██╔═══╝ ██╔══██╗██╔══╝╚════╝██╔═══╝ ██╔══██╗██║   ██║██║     ██╔══╝  ╚════██║╚════██║
//  ██║     ██║  ██║███████╗    ██║     ██║  ██║╚██████╔╝╚██████╗███████╗███████║███████║
//  ╚═╝     ╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚══════╝╚══════╝╚══════╝
//
//  ██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗  SSSSSS
//  ██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗ S
//  ██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║ SSSSSS
//  ██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║      S
//  ██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝      S
//  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ SSSSSSS
//

const _ = require('@sailshq/lodash');

/**
 * [exports description]
 *
 * TODO: Document this utility
 *
 * TODO: change the name of this utility to reflect the fact that its job is
 * to pre-process new incoming records (plural)
 *
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
module.exports = function preProcessRecord(options) {
  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   │ │├─┘ │ ││ ││││└─┐
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘┴   ┴ ┴└─┘┘└┘└─┘
  if (_.isUndefined(options) || !_.isPlainObject(options)) {
    throw new Error(
      'Invalid options argument. Options must contain: records, identity, and orm.',
    );
  }

  if (!_.has(options, 'records') || !_.isArray(options.records)) {
    throw new Error(
      'Invalid option used in options argument. Missing or invalid records.',
    );
  }

  if (!_.has(options, 'identity') || !_.isString(options.identity)) {
    throw new Error(
      'Invalid option used in options argument. Missing or invalid identity.',
    );
  }

  if (!_.has(options, 'model') || !_.isPlainObject(options.model)) {
    throw new Error(
      'Invalid option used in options argument. Missing or invalid model.',
    );
  }

  if (_.has(options, 'params') && _.isPlainObject(options.params)) {
    const { params } = options;
    const [fromCollection, fromDocument] = params.from.split('/');
    const [toCollection, toDocument] = params.from.split('/');
    if (!fromCollection || !fromDocument) {
      throw new Error(
        'Invalid option used in params argument. Missing `from` vertex or document.',
      );
    }

    if (!toCollection || !toDocument) {
      throw new Error(
        'Invalid option used in params argument. Missing `to` vertex or document.',
      );
    }
  }

  const { records, model } = options;

  const primaryKeyColumnName = model.attributes[model.primaryKey].columnName;
  let newrecords = [];

  try {
    newrecords = [...records].map((record) => {
      const pkValue = record[primaryKeyColumnName];

      if (!pkValue) {
        // remove the field
        delete record[primaryKeyColumnName];
      }
      return record;
    });
  } catch (error) {
    throw new Error(`Error normalizing your records. ${error}`);
  }

  return newrecords;

  // Check whether model definitions matches each record. Also set the ID Value for saving

  // check whether there is id field, createdAt, updatedAt
};
