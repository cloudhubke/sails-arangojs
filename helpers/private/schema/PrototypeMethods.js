const _ = require('lodash');
const Helpers = require('../');

module.exports = (globalId) => {
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // PROTOTYPES
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  return {
    update: async function update(callback, trx, options = {}) {
      try {
        let updateValues;
        if (typeof callback === 'function') {
          updateValues = callback(this);
        } else if (_.isPlainObject(callback)) {
          updateValues = { ...callback };
        } else {
          throw new Error(
            `Update parameter should be a callback or plain object`
          );
        }

        const statement = Helpers.query.compileStatement({
          pkColumnName: this.pkColumnName,
          model: this.tableName,
          method: 'update',
          criteria: {
            let: {},
            where: { [this.pkColumnName]: this.id || this._key },
            limit: 9007199254740991,
            skip: 0,
            sort: [],
          },
          values: updateValues,
        });

        let updatedDoc;

        if (this.merchantcode || this.tenantcode) {
          global[`${globalId}Object`].validate({
            ...this,
            ...statement.valuesToSet,
          });

          updatedDoc = await global[`_${globalId}`](
            this.merchantcode || this.tenantcode
          )
            .updateOne({ id: this.id })
            .set({ ...updateValues })
            .meta({
              trx,
              ...options,
            });
        } else {
          global[`${globalId}Object`].validate({
            ...this,
            ...statement.valuesToSet,
          });

          updatedDoc = await global[`${globalId}`]
            .updateOne({ id: this.id })
            .set({ ...updateValues })
            .meta({
              trx,
              ...options,
            });
        }
        if (updatedDoc) {
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          // IMPORTANT! set to null
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          if (this.saveToCache) {
            if (this.tenantcode) {
              global[`${globalId}Object`][`Available${globalId}s`][
                `${this.tenantcode}/${updatedDoc.id}`
              ] = null;
            } else {
              global[`${globalId}Object`][`Available${globalId}s`][
                updatedDoc.id
              ] = null;
            }
          }
          this.reInitialize(updatedDoc);
        } else {
          throw new Error(`Update could not reInitialize `);
        }
      } catch (error) {
        throw new Error(`Error updating document: ${error.toString()}`);
      }
    },

    destroy: async function destroy(trx) {
      try {
        await this[`_${globalId}`].destroy({ id: this.id }).meta({
          trx,
        });
      } catch (error) {
        throw error;
      }
    },

    loadCalculatedProps: function loadCalculatedProps() {
      if (typeof this.afterInitialize === 'function') {
        if (this.afterInitialize.constructor.name === 'AsyncFunction') {
          console.log(
            `Its not advisable that 'afterInitialize' function in ${globalId} should be async or should call other collections: Aborting.`
          );
        } else {
          this.afterInitialize();
        }
      }

      Object.defineProperty(this, 'keyProps', {
        get: () => {
          if (!this.getKeyProps) {
            return {};
          }
          return this.getKeyProps();
        },
        configurable: true,
      });
    },

    reInitialize: function reInitialize(doc) {
      try {
        if (!doc._id || !`${doc._id}`.includes(this.tableName)) {
          throw new Error(`INVALID DOCUMENT INITIALIZED`);
        }

        for (let key of Object.keys(doc)) {
          this[key] = doc[key];
          if (doc.id) {
            this._key = doc.id;
          }
          if (doc._key) {
            this.id = doc._key;
          }
        }

        this.loadCalculatedProps();
        this.saveToCache();
      } catch (error) {
        throw error;
      }
    },

    getKeyProps: function getKeyProps() {
      try {
        let props = {};
        for (let prop of global[`${globalId}Object`].keyProps) {
          props[prop] = this[prop];
        }

        return {
          ...props,
          id: this.id || this._key,
          _id: this._id,
        };
      } catch (error) {
        throw error;
      }
    },
    saveToCache: function saveToCache() {
      if (this.cache) {
        if (this.tenantcode) {
          global[`${this.globalId}Object`][`Available${this.globalId}s`][
            `${this.tenantcode}/${this.id}`
          ] = this;
        } else {
          global[`${this.globalId}Object`][`Available${this.globalId}s`][
            this.id
          ] = this;
        }
      }
    },

    getDocument: function getDocument({ _id }) {
      return global.getDocument({ _id }, this.merchantcode);
    },

    getDocumentAsync: function getDocument({ _id }) {
      return global.getDocument({ _id }, this.merchantcode);
    },

    nextId: async function nextId(name) {
      if (!this._Counter) {
        throw new Error(`Counter collection not found`);
      }

      const next = await this._Transaction({
        action: function (params) {
          const next = CounterDbo.nextId(params.name);

          return next;
        },
        writes: ['counter'],
        params: {
          name,
        },
      });

      return next;
    },
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // DELETE does not work because the WAL result only has the _key
    // Until we are able to have events working, we live it here for now,
    // But it will not work for the moment
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    onDelete: async function onDelete(trx) {
      if (this._Deleted) {
        await this._Deleted.create({
          Document: { ...this },
          Timestamp: Date.now(),
        });
      }

      if (
        typeof model.ModelObjectConstructor.prototype['onDestroy'] ===
        'function'
      ) {
        return docObj.onDestroy();
      } else if (
        typeof model.ModelObjectConstructor.prototype['onRemove'] === 'function'
      ) {
        return docObj.onRemove();
      }
    },
  };
};
