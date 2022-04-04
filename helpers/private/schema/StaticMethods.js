const _ = require('@sailshq/lodash');
const util = require('util');
const validateSchema = require('./validate-schema');

String.prototype.capitalizeCollection = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

if (!global.getDocument) {
  global.getDocument = async function getDocument(searchValue, merchantcode) {
    try {
      let _id = '';

      if (_.isString(searchValue) && `${searchValue}`.includes('/')) {
        _id = searchValue;
      }

      if (
        _.isObject(searchValue) &&
        searchValue._id &&
        `${searchValue._id}`.includes('/')
      ) {
        _id = `${searchValue._id}`;
      }

      const tableName = `${_id}`.split('/')[0].capitalizeCollection();

      if (!_id) {
        throw new Error(
          `_id attribute should either be an object or a string in ${
            tableName || 'getDocumentAsync'
          }`
        );
      }

      if (!global[tableName]) {
        throw new Error(
          `Global object for ${tableName} not found in getDocument`
        );
      }

      let obj;
      if (merchantcode) {
        obj = await global[`${tableName}Object`][`getOne`](
          {
            _id: _id,
          },
          merchantcode
        );
        return obj;
      }
      obj = await global[`${tableName}Object`][`getOne`]({
        _id: _id,
      });
      return obj;
    } catch (error) {
      throw error;
    }
  };

  global.getDocumentAsync = global.getDocument;
}

module.exports = ({
  classType,
  globalId,
  tableName,
  keyProps,
  searchFields,
  cache,
  gIds,
  modelsArray,
  tenantType,
  modelAttributes,
  collections,
  modelDefaults,
  pkColumnName,
  schema,
}) => {
  // let gIds = global[`${globalId}Object`].globalIds || [];

  const getTenantGids = () => {
    return modelsArray.reduce((acc, model) => {
      const arr = _.intersection(tenantType || [], model.tenantType || []);
      if (arr.length > 0) {
        acc = [...acc, model.globalId];
      }
    }, []);
  };

  const create = async function (params, dsName) {
    try {
      if (params.Email) {
        params.Email = `${params.Email}`.toLowerCase().trim();
      }

      const doc = await global[`${globalId}Object`].findOne(
        {
          id: params.id,
        },
        dsName
      );

      if (doc) {
        throw new Error(`Document with same id already exists`);
      }

      let newdoc;

      if (dsName) {
        newdoc = await global[`_${globalId}`](dsName).create(params).fetch();
      } else {
        newdoc = await global[globalId].create(params).fetch();
      }

      return newdoc;
    } catch (error) {
      throw error;
    }
  };

  const findOne = async function (params, dsName) {
    try {
      const { id, _id, ...otherprops } = params || {};

      let doc;
      if (id) {
        if (dsName) {
          doc = await global[`_${globalId}`](dsName).findOne({ id: id });
        } else {
          doc = await global[`${globalId}`].findOne({ id: id });
        }
      }

      if (!doc && _id) {
        if (dsName) {
          doc = await global[`_${globalId}`](dsName).findOne({ _id: _id });
        } else {
          doc = await global[`${globalId}`].findOne({ _id: _id });
        }
      }

      if (!doc) {
        for (let prop in otherprops) {
          if (!keyProps.includes(prop) || Boolean(doc)) {
            // throw new Error(`${prop} is not a key props`);
            continue;
          }

          if (['string', 'number'].includes(typeof otherprops[prop])) {
            if (dsName) {
              doc = await global[`_${globalId}`](dsName).findOne({
                [prop]: otherprops[prop],
              });
            } else {
              doc = await global[`${globalId}`].findOne({
                [prop]: otherprops[prop],
              });
            }
          }
        }
      }

      return doc;
    } catch (error) {
      throw new Error(`find one error ${error.toString()}`);
    }
  };

  const findDocument = async function (params, dsName) {
    try {
      const { id, ...otherprops } = params || {};

      if (cache) {
        if (dsName) {
          if (
            id &&
            global[`${globalId}Object`][`Available${globalId}s`][
              `${dsName}/${id}`
            ]
          ) {
            return global[`${globalId}Object`][`Available${globalId}s`][
              `${dsName}/${id}`
            ];
          }
        } else {
          if (id && global[`${globalId}Object`][`Available${globalId}s`][id]) {
            return global[`${globalId}Object`][`Available${globalId}s`][id];
          }
        }
      }

      let doc;

      if (id) {
        if (dsName) {
          doc = await global[`_${globalId}`](dsName).findOne({ id: id }).meta({
            fireOnGetOne: false,
          });
        } else {
          doc = await global[`${globalId}`].findOne({ id: id }).meta({
            fireOnGetOne: false,
          });
        }
      }

      if (!doc) {
        for (let prop in otherprops) {
          if (['string', 'number'].includes(typeof otherprops[prop])) {
            if (dsName) {
              doc = await global[`_${globalId}`](dsName)
                .findOne({
                  [prop]: otherprops[prop],
                })
                .meta({
                  fireOnGetOne: false,
                });
            } else {
              doc = await global[`${globalId}`]
                .findOne({
                  [prop]: otherprops[prop],
                })
                .meta({
                  fireOnGetOne: false,
                });
            }
          }
        }
      }
      return doc;
    } catch (error) {
      throw error;
    }
  };

  const getOne = async function (params, dsName) {
    try {
      const { id: _key, _id } = params || {};

      const id = `${_key || `${_id}`.split('/')[1]}`;

      if (cache) {
        if (dsName) {
          if (
            id &&
            global[`${globalId}Object`][`Available${globalId}s`][
              `${dsName}/${id}`
            ]
          ) {
            return global[`${globalId}Object`][`Available${globalId}s`][
              `${dsName}/${id}`
            ];
          }
        } else {
          if (id && global[`${globalId}Object`][`Available${globalId}s`][id]) {
            return global[`${globalId}Object`][`Available${globalId}s`][id];
          }
        }
      }

      const obj = await global[`${globalId}Object`].findOne(params, dsName);

      if (obj && obj.id) {
        obj.saveToCache();
      } else {
        throw new Error(
          `\n\n${globalId} not available in ${
            dsName || 'default'
          } datastore\n\n`
        );
      }

      return obj;
    } catch (error) {
      throw error;
    }
  };

  return {
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // STATIC METHODS
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    globalId,
    globalIds: gIds,
    collections,
    tableName: `${tableName}`.toLowerCase(),
    keyProps,
    searchFields,
    modelDefaults,
    modelAttributes,
    tenantType,
    cache,
    pkColumnName,
    schema,
    [`Available${globalId}s`]: {},
    findOneOrCreate: async function (params, dsName) {
      try {
        let doc;
        if (dsName) {
          doc = await global[`_${globalId}`](dsName).findOne(params);
          if (!doc) {
            doc = await global[`_${globalId}`](dsName).create(params).fetch();
          }
        } else {
          doc = await global[`${globalId}`].findOne(params);
          if (!doc) {
            doc = await global[`${globalId}`].create(params).fetch();
          }
        }

        return doc;
      } catch (error) {
        throw error;
      }
    },

    initialize: function initialize(doc, dsName, initOne) {
      try {
        if (!doc._id || !`${doc._id}`.includes(tableName)) {
          throw new Error(`INVALID DOCUMENT INITIALIZED`);
        }

        if (doc instanceof global[`${globalId}Object`]) {
          if (dsName && dsName !== doc.tenantcode) {
            return global[`${globalId}Object`].initialize({ ...doc }, dsName);
          }

          doc.reInitialize(doc);
          return doc;
        }

        let docObj;
        if (doc) {
          if (dsName) {
            docObj = new global[`${globalId}Object`](dsName);
          } else {
            docObj = new global[`${globalId}Object`]();
          }

          for (let key of Object.keys(doc)) {
            docObj[key] = doc[key];
            if (doc.id) {
              docObj._key = doc.id;
            }
            if (doc._key) {
              docObj.id = doc._key;
            }
          }

          Object.defineProperty(docObj, 'tableName', {
            get: () => {
              return `${globalId}`.toLowerCase();
            },
          });

          Object.defineProperty(docObj, 'pkColumnName', {
            get: () => {
              return `${pkColumnName}`.toLowerCase();
            },
          });

          Object.defineProperty(docObj, 'schema', {
            get: () => {
              return `${schema}`.toLowerCase();
            },
          });

          Object.defineProperty(docObj, 'cache', {
            get: () => {
              return cache;
            },
          });
          Object.defineProperty(docObj, 'globalId', {
            get: () => {
              return globalId;
            },
          });
          Object.defineProperty(docObj, 'classType', {
            get: () => {
              return classType;
            },
          });

          Object.defineProperty(docObj, '_Transaction', {
            get: () => {
              if (docObj.tenantcode) {
                return sails.getDatastore(docObj.tenantcode).manager
                  .Transaction;
              }
              return sails.getDatastore().manager.Transaction;
            },
          });
          Object.defineProperty(docObj, '_dbConnection', {
            get: () => {
              if (docObj.tenantcode) {
                return sails.getDatastore(docObj.tenantcode).manager
                  .dbConnection;
              }
              return sails.getDatastore().manager.dbConnection;
            },
          });

          if (!global[`${globalId}Object`].gIds) {
            global[`${globalId}Object`].gIds = modelsArray
              .filter((m) => {
                const arr = (tenantType || []).reduce((acc, t) => {
                  if (m.tenantTypes.includes(t)) {
                    acc.push(t);
                  }
                  return acc;
                }, []);
                return arr.length > 0;
              })
              .map((m) => m.globalId);
          }

          let gIdsInTenant = global[`${globalId}Object`].gIds;

          if (Array.isArray(gIdsInTenant)) {
            _.each(gIdsInTenant, (gId) => {
              Object.defineProperty(docObj, `_${gId}`, {
                get: () => {
                  if (docObj.tenantcode) {
                    return global[`_${gId}`](docObj.tenantcode);
                  }
                  return global[gId];
                },
              });
            });
          }

          if (typeof docObj.loadCalculatedProps === 'function') {
            docObj.loadCalculatedProps();
          }

          if (docObj.saveToCache) {
            docObj.saveToCache();
          }

          if (initOne) {
            if (typeof docObj.onGetOne === 'function') {
              const strFn = String(docObj.onGetOne);

              if (
                strFn.includes('getOne') ||
                strFn.includes('.onGetOne') ||
                strFn.includes('findOne') ||
                strFn.includes('getDocument') ||
                strFn.includes(`'onGetOne'`) ||
                strFn.includes(`"onGetOne"`)
              ) {
                const e = `Invalid function implementation onGetOne inside ${docObj.globalId}.
                The following functions cannot be called inside a ONGETONE(onGetOne) method:
                onGetOne
                getOne
                findOne
                getDocument                
                This is to avoid infinite loops. Consider using .findDocument`;

                console.log('====================================');
                console.log(e);
                console.log('====================================');
                throw new Error(e);
              }
              if (
                docObj.onGetOne.constructor.name === 'AsyncFunction' ||
                util.types.isAsyncFunction(docObj.onGetOne)
              ) {
                return new Promise(async (resolve, reject) => {
                  try {
                    await docObj.onGetOne();
                    resolve(docObj);
                  } catch (error) {
                    reject(error);
                  }
                });
              } else {
                docObj.onGetOne();
              }
            }
          }
        }
        return docObj;
      } catch (error) {
        throw new Error(
          `${globalId} INITIALIZATION ERROR: ${error.toString()}`
        );
      }
    },

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // validation
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    validate: function validate(values) {
      try {
        let shema = schema || {};
        schema = schema.rule || {};

        if (schema.properties) {
          const newprops = {};
          for (let prop in schema.properties) {
            const { linkCollections, validateLinks, ...otherprops } =
              schema.properties[prop];
            newprops[prop] = otherprops;
          }
          schema.properties = newprops;
        }

        validateSchema(
          {
            tableName,
          },
          schema,
          {
            ...values,
          }
        );
      } catch (error) {
        throw new Error(`${globalId} VALIDATION ERROR: ${error.toString()}`);
      }
    },

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // ALIASES
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    findDocument,
    findOne,
    getOne,
    create,

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // PROTOTYPES
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  };
};
