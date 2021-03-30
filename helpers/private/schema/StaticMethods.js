const _ = require('@sailshq/lodash');

String.prototype.capitalizeCollection = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

if (!global.getDocument) {
  global.getDocument = async function getDocument({ _id }, merchantcode) {
    try {
      if (!_id || !_.isString(_id) || !`${_id}`.includes('/')) {
        throw new Error(`_id is required in getDocument`);
      }

      const tableName = `${_id}`.split('/')[0].capitalizeCollection();

      if (!global[tableName]) {
        throw new Error(
          `Global object for ${tableName} not found in getDocument`
        );
      }

      let obj;
      if (merchantcode) {
        obj = await global[`${tableName}Object`][`get${tableName}`](
          {
            _id: _id,
          },
          merchantcode
        );
        return obj;
      }
      obj = await global[`${tableName}Object`][`get${tableName}`]({
        _id: _id,
      });
      return obj;
    } catch (error) {
      console.log('====================================');
      console.log(error);
      console.log('====================================');
      throw error;
    }
  };
}

module.exports = (globalId, keyProps, cache, gIds) => {
  const create = async function (params, dsName) {
    try {
      if (params.Email) {
        params.Email = `${params.Email}`.toLocaleLowerCase().trim();
      }

      const doc = await global[`${globalId}Object`][`find${globalId}`](
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

      if (newdoc) {
        const doc = global[`${globalId}Object`].initialize(newdoc, dsName);
        return doc;
      }
      return null;
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

      for (let prop in otherprops) {
        if (otherprops[prop] && !doc) {
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

      if (doc) {
        if (dsName) {
          return global[`${globalId}Object`].initialize(doc, dsName);
        }
        return global[`${globalId}Object`].initialize(doc);
      }

      return null;
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

      const obj = await global[`${globalId}Object`][`find${globalId}`](
        params,
        dsName
      );

      if (obj && obj.id) {
        obj.saveToCache();
      } else {
        throw new Error(
          `${globalId} not available in ${dsName || 'default'} datastore`
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
    tableName: `${globalId}`.toLocaleLowerCase(),
    keyProps,
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

    [`get${globalId}`]: getOne,
    [`create${globalId}`]: create,
    [`find${globalId}`]: findOne,

    initialize: function initialize(doc, dsName) {
      try {
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
          }

          Object.defineProperty(docObj, 'keyProps', {
            get: () => {
              if (!docObj.getKeyProps) {
                return {};
              }
              return docObj.getKeyProps();
            },
          });

          Object.defineProperty(docObj, 'tableName', {
            get: () => {
              return `${globalId}`.toLocaleLowerCase();
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

          if (docObj.saveToCache) {
            docObj.saveToCache();
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

    findOne,
    getOne,
    create,

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // PROTOTYPES
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  };
};
