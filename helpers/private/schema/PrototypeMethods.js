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

          this.reinitialize(updatedDoc);
        } else {
          throw new Error(`Dbo update function expects a callback`);
        }
      } catch (error) {
        throw error;
      }
    },

    reInitialize: function reinitialize(doc) {
      try {
        for (let key in doc) {
          this[key] = doc[key];
        }

        let props = {};
        for (let prop of this.keyProps) {
          props[prop] = doc[prop];
        }

        this.constructor.prototype.keyProps = {
          ...props,
          id: doc.id || doc._key,
          _id: doc._id,
        };
      } catch (error) {
        throw error;
      }
    },
  };
};
