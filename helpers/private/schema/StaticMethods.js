const _ = require('@sailshq/lodash');
const util = require('util');

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

      if (!_id) {
        throw new Error(
          `_id attribute should either be an object or a string in ${tableName}`
        );
      }

      const tableName = `${_id}`.split('/')[0].capitalizeCollection();

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
}

module.exports = ({
  globalId,
  tableName,
  keyProps,
  cache,
  gIds,
  modelDefaults,
}) => {
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
      const { id, ...otherprops } = params || {};

      let doc;
      if (id) {
        if (dsName) {
          doc = await global[`_${globalId}`](dsName).findOne({ id: id });
        } else {
          doc = await global[`${globalId}`].findOne({ id: id });
        }
      }

      if (!doc) {
        for (let prop in otherprops) {
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
      throw error;
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
      const { id } = params || {};

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
    tableName: `${tableName}`.toLowerCase(),
    keyProps,
    modelDefaults,
    cache,
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

          Object.defineProperty(docObj, '_Transaction', {
            get: () => {
              if (docObj.tenantcode) {
                return sails.getDatastore(docObj.tenantcode).manager
                  .Transaction;
              }
              return sails.getDatastore().manager.Transaction;
            },
          });

          if (gIds) {
            _.each(gIds, (gId) => {
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
                return new Promise(async (resolve) => {
                  await docObj.onGetOne();
                  resolve(docObj);
                });
              } else {
                docObj.onGetOne();
              }
            }
          }
        }
        return docObj;
      } catch (error) {
        throw error;
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
