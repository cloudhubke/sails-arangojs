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

          this.reInitialize(updatedDoc);
        } else {
          throw new Error(`Dbo update function expects a callback`);
        }
      } catch (error) {
        throw error;
      }
    },

    reInitialize: function reInitialize(doc) {
      try {
        for (let key of Object.keys(doc)) {
          this[key] = doc[key];
        }
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
  };
};
