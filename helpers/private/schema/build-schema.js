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
        (attribute, name) =>
          new Promise(async (resolv) => {
            const unique = Boolean(attribute.unique);
            // attribute.unique, allowNull, etc
            if (attribute && unique && !attribute.primaryKey) {
              const ind = await collection.createHashIndex(`${name}`, {
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
      (attribute, name) =>
        new Promise(async (resolv) => {
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
  createdIndexes = createdIndexes.filter((i) => !!i);

  // Delete indexes when they are removed from model
  for (let fld of modelIndexes) {
    if (fld.fields.length === 1) {
      const indexfield = fld.fields.join('');
      if (indexfield !== '_key') {
        if (!createdIndexes.includes(indexfield)) {
          await collection.dropIndex(fld.name);
        }
      }
    } else {
      const indexfield = fld.fields.join('');
      if (indexfield !== '_from_to') {
        await collection.dropIndex(fld);
      }
    }
  }

  // Build up a string of column attributes

  // ENFORCE SCHEMA in DB

  if (['strict', 'moderate', 'new'].includes(definition.schemaValidation)) {
    const attributes = { ...definition.attributes };

    delete attributes.createdAt;
    delete attributes.updatedAt;
    delete attributes.id;
    delete attributes._key;
    delete attributes._id;

    let required = [];
    let properties = {};

    for (let fldName in attributes) {
      let fldProps = {};
      const attProps = attributes[fldName] || {};

      if (
        attProps.required ||
        attProps.defaultsTo ||
        typeof attProps.defaultsTo === 'number'
      ) {
        required.push(fldName);
      }

      if (attProps.type === 'string' && !attProps.allowNull) {
        fldProps.type = attProps.type;
        const rules = attProps.rules || {};

        if (typeof rules.minLength === 'number') {
          fldProps.minLength = rules.minLength;
        }
        if (typeof rules.maxLength === 'number') {
          fldProps.maxLength = rules.maxLength;
        }

        if (typeof rules.pattern === 'object') {
          // prettier-ignore
          fldProps.pattern = String(rules.pattern).replace('/^','^').replace('$/', '$');
        }

        if (typeof rules.format === 'format') {
          fldProps.format = rules.format;
        }

        for (let key in rules) {
          if (!['minLength', 'maxLength', 'pattern', 'format'].includes(key)) {
            throw new Error(
              `Schema Validation property ${key} in attribute ${fldName} of Model ${tableName} is not supported
                
                Supported properties are 'minLength', 'maxLength'
                `
            );
          }
        }

        const validations = attProps.validations || {};

        if (validations.isIn && _.isArray(validations.isIn)) {
          fldProps.enum = [...validations.isIn];
        }
      }

      if (attProps.type === 'number') {
        fldProps.type = attProps.type;

        const rules = attProps.rules || {};

        if (typeof rules.minimum === 'number') {
          fldProps.minimum = rules.minimum;
        }
        if (typeof rules.maximum === 'number') {
          fldProps.maximum = rules.maximum;
        }
        if (typeof rules.exclusiveMinimum === 'number') {
          fldProps.exclusiveMinimum = rules.exclusiveMinimum;
        }
        if (typeof rules.exclusiveMaximum === 'number') {
          fldProps.exclusiveMaximum = rules.exclusiveMaximum;
        }

        if (typeof rules.multipleOf === 'number') {
          fldProps.multipleOf = rules.multipleOf;
        }

        for (let key in rules) {
          if (
            ![
              'minimum',
              'maximum',
              'exclusiveMaximum',
              'exclusiveMinimum',
              'multipleOf',
            ].includes(key)
          ) {
            throw new Error(
              `Schema Validation property ${key} in attribute ${fldName} of Model ${tableName} is not supported
                
                Supported properties are 'minimum', 'maximum'
                `
            );
          }
        }
      }
      if (attProps.type === 'boolean') {
        fldProps.type = attProps.type;
        const rules = attProps.rules || {};
      }

      if (attProps.type === 'json' && _.isArray(attProps.defaultsTo)) {
        fldProps.type = 'array';
        const rules = attProps.rules || {};

        for (let key in rules) {
          if (!['items', 'uniqueItems'].includes(key)) {
            throw new Error(
              `Schema Validation property ${key} in attribute ${fldName} of Model ${tableName} is not supported
                
                supported properties are 'items', 'uniqueItems'
                `
            );
          }
        }

        if (rules.items && _.isPlainObject(rules.items)) {
          fldProps.items = { ...rules.items };

          if (fldProps.items.required && _.isArray(fldProps.items.required)) {
            fldProps.items.required = [...fldProps.items.required].filter(
              (r) => r !== '_key' && r !== '_id'
            );

            for (let r of fldProps.items.required) {
              if (!fldProps.items.properties[r]) {
                throw new Error(
                  `${r} rules property ${r} in array items of ${tableName}.${fldName} is not included in the rules properties      
                    `
                );
              }
            }
          }
        }
        if (rules.items && _.isArray(rules.items)) {
          fldProps.items = { ...rules.items };
        }
        if (rules.uniqueItems) {
          fldProps.uniqueItems = true;
        }
      }

      if (attProps.type === 'json' && _.isPlainObject(attProps.defaultsTo)) {
        fldProps.type = 'object';
        const rules = attProps.rules || {};

        for (let key in rules) {
          if (
            !['properties', 'additionalProperties', 'required'].includes(key)
          ) {
            throw new Error(
              `Schema Validation property ${key} in attribute ${fldName} of Model ${tableName} is not supported
                
                supported properties are 'properties', 'additionalProperties', 'required'
                `
            );
          }
        }

        if (rules.properties && _.isPlainObject(rules.properties)) {
          fldProps.properties = { ...rules.properties };
          for (let p in fldProps.properties) {
            const obj = fldProps.properties[p] || {};
            if (
              !['string', 'number', 'boolean', 'array', 'object'].includes(
                obj.type
              )
            ) {
              throw new Error(`
                
                Error setting schema validation ${p} in attribute ${fldName} of Model ${tableName} 

                expects object of type 'string', 'number', 'boolean', 'array', 'object'
                
                `);
            }
          }

          if (rules.required && _.isArray(rules.required)) {
            fldProps.required = [...rules.required].filter(
              (r) => r !== '_key' && r !== '_id'
            );

            for (let r of fldProps.required) {
              if (!fldProps.properties[r]) {
                throw new Error(
                  `${r} rules property for attribute ${fldName} in schema ${tableName} is not included in the rules properties
                                     
                    `
                );
              }
            }
          }
        }
        if (
          rules.additionalProperties &&
          _.isPlainObject(rules.additionalProperties)
        ) {
          fldProps.additionalProperties = {
            ...rules.additionalProperties,
          };
        }
      }

      if (
        attProps.type === 'json' &&
        attProps.defaultsTo &&
        !_.isArray(attProps.defaultsTo) &&
        !_.isPlainObject(attProps.defaultsTo)
      ) {
        throw new Error(
          `Invalid defaultsTo property in attribute ${fldName} in model ${tableName}`
        );
      }

      properties[fldName] = { ...fldProps };
    }

    const schema = {
      rule: {
        properties,
        additionalProperties: Boolean(definition.additionalProperties),
        ...(_.isEmpty(required) ? {} : { required }),
      },
      level: definition.schemaValidation,
      message: `
      Please check your document:

      Schema violation for ${tableName}
     
      `,
    };

    await collection.setProperties({ schema: schema });
  } else {
    await collection.setProperties({ schema: null });
  }

  return true;
};
