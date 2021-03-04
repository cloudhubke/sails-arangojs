function getObject(globalId) {
  return String(global[`${globalId}Dbo`]);
}

module.exports = (globalId, keyProps) => {
  const globalid = `${globalId}`.toLocaleLowerCase();
  const methods = () => ({
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // STATIC METHODS
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    globalId: `"${globalId}"`,
    keyProps: JSON.stringify(keyProps),

    create: function (params) {
      const doc = db.globalid.insert(params, { returnNew: true }).new;
      return globalIdDbo.initialize(doc);
    },

    getDocument: function (params) {
      const doc = db.globalid.document(params);
      return globalIdDbo.initialize(doc);
    },

    initialize: function (doc) {
      if (doc instanceof globalIdDbo) {
        //Re Initialize
        doc.reInitialize(doc);
        return doc;
      }

      const obj = new globalIdDbo();
      for (let key of Object.keys(doc)) {
        obj[key] = doc[key];
        obj.id = doc._key;
      }

      let props = {};
      for (let prop of globalIdDbo.keyProps) {
        props[prop] = doc[prop];
      }

      Object.defineProperty(obj, 'keyProps', {
        get: () => {
          return obj.getKeyProps();
        },
      });

      return obj;
    },

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // PROTOTYPES
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  });

  const prototypes = () => ({
    getKeyProps: function getKeyProps() {
      let props = {};
      for (let prop of this.constructor.keyProps) {
        props[prop] = this[prop];
      }

      return {
        ...props,
        id: this._key,
        _id: this._id,
      };
    },
    reInitialize: function (doc) {
      for (let key of Object.keys(doc)) {
        this[key] = doc[key];
      }
    },
    update: function (callback) {
      if (typeof callback === 'function') {
        const updateValues = callback(this);
        const updatedDoc = db._update(
          this,
          { ...updateValues },
          { returnNew: true }
        ).new;
        this.reInitialize(updatedDoc);
      } else {
        throw new Error(`Dbo update function expects a callback`);
      }
    },
  });

  Object.assign(global[`${globalId}Dbo`], methods());
  Object.assign(global[`${globalId}Dbo`].prototype, prototypes());

  const objString = `${getObject(globalId)}\n`;

  let methodsString = '';
  for (let key in global[`${globalId}Dbo`]) {
    methodsString = `${methodsString}${key}: ${String(
      global[`${globalId}Dbo`][key]
    )},\n`;
  }

  methodsString = `${methodsString}`.replace(/globalIdDbo/g, `${globalId}Dbo`);
  methodsString = `${methodsString}`.replace(/globalid/g, `${globalid}`);

  methodsString = `const ${globalId}StaticMethods = {\n${methodsString}\n}\n\nObject.assign(${globalId}Dbo, ${globalId}StaticMethods);\n`;

  let protypesString = '';
  for (let key in global[`${globalId}Dbo`].prototype) {
    protypesString = `${protypesString}${globalId}Dbo.prototype.${key} = ${String(
      global[`${globalId}Dbo`].prototype[key]
    )}\n`;
  }

  return `${objString}${methodsString}${protypesString}`;
};
