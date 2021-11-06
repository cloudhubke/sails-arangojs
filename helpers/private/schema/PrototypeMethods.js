const _ = require('lodash');
module.exports = (globalId) => {
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // PROTOTYPES
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  return {
    onCheckLinks: async function () {
      try {
        if (this.classType === 'Edge') {
          return;
        }

        const plainDoc = { ...this };
        let links = [];
        for (let key in plainDoc) {
          if (plainDoc[key] && plainDoc[key]._id) {
            links.push({
              PropertyName: key,
              _id: plainDoc[key]._id,
            });
          }
          if (Array.isArray(plainDoc[key])) {
            plainDoc[key].forEach((item) => {
              if (item && item._id) {
                links.push({
                  PropertyName: key,
                  _id: item._id,
                });
              }
            });
          }
        }

        links = _.uniqBy(links, '_id');

        if (links.length <= 0) {
          return;
        }

        let collection;

        if (!this._links) {
          collection = this._dbConnection.collection('links');
          const result = await collection.exists(); // true
          if (!result) {
            await collection.create({ type: 3 });
          }
        }

        if (this._links && this._links.classType !== 'Edge') {
          console.log('💥💥💥 LINKING ERROR💥💥💥');
          console.log('====================================');
          console.log('Links collection should be of type edge');
          console.log('====================================');
          return;
        }

        await this._Transaction({
          action: function ({ _id, links }) {
            //First remove existing links if any;
            collectionName = `${_id}`.split('/')[0];
            db._query(
              `FOR rec in links FILTER rec._from=='${_id}' REMOVE rec in links`
            );
            for (let link of links) {
              const { _id: link_id, ...linkData } = link;
              db.links.save(
                { _id },
                { _id: link_id },
                {
                  Timestamp: Date.now(),
                  PropertyName: link.PropertyName,
                }
              );
            }
          },
          writes: ['links'],
          params: {
            _id: this._id,
            links: links,
          },
        });
      } catch (error) {
        console.log(error.toString());
      }
    },
    update: async function update(callback, trx) {
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

        let updatedDoc;

        if (this.merchantcode || this.tenantcode) {
          updatedDoc = await global[`_${globalId}`](
            this.merchantcode || this.tenantcode
          )
            .updateOne({ id: this.id })
            .set({ ...updateValues })
            .meta({
              trx,
            });
        } else {
          updatedDoc = await global[`${globalId}`]
            .updateOne({ id: this.id })
            .set({ ...updateValues })
            .meta({
              trx,
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
          throw new Error(`Update could not reInitialize`);
        }
      } catch (error) {
        throw error;
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
  };
};
