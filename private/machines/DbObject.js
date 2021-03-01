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

    [`get${globalId}`]: function (params) {
      const doc = db.globalid.document(params);
      return globalIdDbo.initialize(doc);
    },

    initialize: function (doc) {
      if (doc instanceof globalIdDbo) {
        return doc;
      }

      const obj = new globalIdDbo();
      for (let key in doc) {
        obj[key] = doc[key];
        obj.id = doc._key;
      }

      let props = {};
      for (let prop of globalIdDbo.keyProps) {
        props[prop] = doc[prop];
      }

      obj.constructor.prototype.keyProps = {
        ...props,
        id: obj._key,
        _id: obj._id,
      };

      return obj;
    },

    update: function (callback) {
      if (typeof callback === 'function') {
        const updateValues = callback(this);
        const updatedDoc = db._update(
          this,
          { ...updateValues },
          { returnNew: true }
        ).new;
        this.initialize(updatedDoc);
      } else {
        throw new Error(`Dbo update function expects a callback`);
      }
    },

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // PROTOTYPES
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  });

  Object.assign(global[`${globalId}Dbo`], methods());

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

  // if (globalId === 'Merchant') {
  //   console.log('====================================');
  //   console.log(`${objString}${methodsString}${protypesString}`);
  //   console.log('====================================');
  // }

  return `${objString}${methodsString}${protypesString}`;
};
