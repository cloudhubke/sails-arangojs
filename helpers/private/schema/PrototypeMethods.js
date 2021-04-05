module.exports = (globalId) => {
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // PROTOTYPES
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  return {
    [`update${globalId}`]: async function initialize(callback) {
      try {
        if (typeof callback === 'function') {
          const updateValues = callback(this);
          let updatedDoc;

          if (this.merchantcode || this.tenantcode) {
            updatedDoc = await global[`_${globalId}`](
              this.merchantcode || this.tenantcode
            )
              .updateOne({ id: this.id })
              .set({ ...updateValues });
          } else {
            updatedDoc = await global[`${globalId}`]
              .updateOne({ id: this.id })
              .set({ ...updateValues });
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
        } else {
          throw new Error(`Dbo update function expects a callback`);
        }
      } catch (error) {
        throw error;
      }
    },

    loadCalculatedProps: function loadCalculatedProps() {
      if (typeof this.afterInitialize === 'function') {
        if (this.afterInitialize.constructor.name === 'AsyncFunction') {
          console.log(
            'Its not advisable that `afterInitialize` function should be async or should call other collections: Aborting.'
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
    update: function update(callback) {
      return this[`update${globalId}`](callback);
    },

    getDocument: function getDocument({ _id }) {
      return getDocument({ _id }, this.merchantcode);
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
