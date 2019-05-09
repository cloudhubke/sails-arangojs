//  ██████╗ ██╗   ██╗██╗██╗     ██████╗     ███████╗ ██████╗██╗  ██╗███████╗███╗   ███╗ █████╗
//  ██╔══██╗██║   ██║██║██║     ██╔══██╗    ██╔════╝██╔════╝██║  ██║██╔════╝████╗ ████║██╔══██╗
//  ██████╔╝██║   ██║██║██║     ██║  ██║    ███████╗██║     ███████║█████╗  ██╔████╔██║███████║
//  ██╔══██╗██║   ██║██║██║     ██║  ██║    ╚════██║██║     ██╔══██║██╔══╝  ██║╚██╔╝██║██╔══██║
//  ██████╔╝╚██████╔╝██║███████╗██████╔╝    ███████║╚██████╗██║  ██║███████╗██║ ╚═╝ ██║██║  ██║
//  ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝     ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
//
// Build a schema object that is suitable for using in a Create Table query.

const _ = require('@sailshq/lodash');

module.exports = function buildSchema(tableName, definition) {
  if (!definition || !tableName) {
    throw new Error('Build Schema/Table Name requires a valid definition.');
  }

  //  ╔╗╔╔═╗╦═╗╔╦╗╔═╗╦  ╦╔═╗╔═╗  ┌┬┐┬ ┬┌─┐┌─┐
  //  ║║║║ ║╠╦╝║║║╠═╣║  ║╔═╝║╣    │ └┬┘├─┘├┤
  //  ╝╚╝╚═╝╩╚═╩ ╩╩ ╩╩═╝╩╚═╝╚═╝   ┴  ┴ ┴  └─┘
  // TODO: move this code inline to eliminate unnecessary function declaration
  const normalizeType = function normalizeType(type, isPrimaryKey) {
    if (isPrimaryKey) {
      return 'STRING';
    }
    switch (type.toLowerCase()) {
      // Default types from sails-hook-orm (for automigrations)
      case '_number':
        return 'DOUBLE';
      case '_numberkey':
        return 'INTEGER';
      case '_numbertimestamp':
        return 'LONG';
      case '_string':
        return 'STRING';
      case '_stringkey':
        return 'STRING';
      case '_stringtimestamp':
        return 'STRING';
      case '_boolean':
        return 'BOOLEAN';
      case '_json':
        return 'ANY';
      case '_ref':
        return 'STRING';

      // Sensible MySQL-specific defaults for common things folks might try to use.
      // (FUTURE: log warnings suggesting proper usage when any of these synonyms are invoked)
      case 'varchar':
        return 'STRING';
      case 'bigint':
        return 'LONG';
      case 'json':
        return 'ANY';
      case 'boolean':
        return 'BOOLEAN';
      case 'text':
        return 'STRING';
      case 'integer':
        return 'INTEGER';

      default:
        return type;
    }
  };

  // Build up a string of column attributes
  const columns = _.map(definition, (attribute, name) => {
    if (_.isString(attribute)) {
      const val = attribute;
      attribute = {};
      attribute.type = val;
    }

    const type = normalizeType(attribute.columnType, attribute.primaryKey);
    const unique = attribute.unique && 'MANDATORY TRUE';
    const nullable = attribute.notNull && 'NOTNULL TRUE';

    let constraints = [nullable, unique].filter(p => !!p).join(', ');
    if (constraints.length > 0) {
      constraints = `(${constraints})`;
    }

    return `CREATE PROPERTY ${tableName}.\`${name}\` ${type} ${constraints}`;
  });

  // Grab the Unique Columns and Create Indexes

  const indexes = _.map(definition, (attribute, name) => {
    const unique = Boolean(attribute.unique);
    if (unique) {
      return `CREATE INDEX ${tableName}.\`${name}\` UNIQUE`;
    }
    return '';
  });

  // // Grab the Primary Key
  // const primaryKeys = _.keys(
  //   _.pick(definition, attribute => attribute.primaryKey),
  // );

  // Add the Primary Key to the definition
  // const constraints = _.compact([
  //   primaryKeys.length && `PRIMARY KEY (${primaryKeys.join(',')})`,
  // ]).join(', ');

  // const schema = _.compact([columns, constraints]).join(', ');
  const schema = [...columns, ...indexes].filter(c => !!c).join(';\n ');

  return schema;
};
