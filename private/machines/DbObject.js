function getObject(globalId) {
  return String(global[`${globalId}Dbo`]);
}

module.exports = ({ globalId, keyProps, modelDefaults, modelAttributes }) => {
  const globalid = `${globalId}`.toLocaleLowerCase();

  const methods = () => ({
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // STATIC METHODS
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    globalId: `"${globalId}"`,
    keyProps: JSON.stringify(keyProps),
    modelDefaults: JSON.stringify(modelDefaults || {}),
    modelAttributes: JSON.stringify(modelAttributes || {}),
    validateParams: function (docParams) {
      const attributes = globalIdDbo.modelAttributes;

      for (let key in attributes) {
        if (key === 'id') {
          continue;
        }
        const type =
          attributes[key].type === 'json' ? 'object' : attributes[key].type;
        const required = attributes[key].required;
        const isIn = attributes[key].isIn;
        const rules = attributes[key].rules || {};

        if (
          Object.keys(docParams).includes(key) &&
          typeof docParams[key] !== type
        ) {
          throw new Error(
            `${key} attribute in ${
              globalIdDbo.globalId
            } should be of type ${type} - ${JSON.stringify(docParams)}`
          );
        }

        if (
          (!Object.keys(docParams).includes(key) || docParams[key] === null) &&
          required
        ) {
          throw new Error(
            `${key} attribute in ${
              globalIdDbo.globalId
            } is required - ${JSON.stringify(docParams)}`
          );
        }

        if (isIn && !isIn.includes(docParams[key])) {
          throw new Error(
            `${key} should be one of ${isIn.join(', ')}. But found ${
              docParams[key]
            } - ${JSON.stringify(docParams)}`
          );
        }

        for (rule in rules) {
          if (rule === 'minimum') {
            if (docParams[key] < rules[rule]) {
              throw new Error(
                `${key} should not be less than ${
                  rules[rule]
                } - ${JSON.stringify(docParams)}`
              );
            }
          }
          if (rule === 'maximum') {
            if (docParams[key] < rules[rule]) {
              throw new Error(
                `${key} should not be more than ${
                  rules[rule]
                } -  ${JSON.stringify(docParams)}`
              );
            }
          }

          if (rule === 'required') {
            if (typeof docParams[key] === 'object') {
              for (let requiredkey of rules[rule]) {
                if (!Object.keys(docParams[key]).includes(requiredkey)) {
                  throw new Error(
                    `${requiredkey} is required in ${key} - ${JSON.stringify(
                      docParams
                    )}`
                  );
                }
              }
            }
          }
        }
      }

      return true;
    },

    create: function (...params) {
      let docParams;
      if (params.length > 2) {
        docParams = {
          ...globalIdDbo.modelDefaults,
          ...params[2],
          createdAt: params[2].createdAt || Date.now(),
        };

        globalIdDbo.validateParams(docParams);

        params[2] = docParams;
        params[3] = { returnNew: true };
      } else {
        if (Array.isArray(params[0])) {
          throw new Error(`Arrays are not supported`);
        } else {
          docParams = {
            ...globalIdDbo.modelDefaults,
            ...params[0],
            createdAt: Date.now(),
          };

          globalIdDbo.validateParams(docParams);

          params[0] = docParams;
          params[1] = { returnNew: true };
        }
      }

      try {
        const doc = db.globalid.insert(...params).new;

        const docObj = globalIdDbo.initialize(doc);
        if (typeof docObj.onGetOne === 'function') {
          docObj.onGetOne();
        }
        return docObj;
      } catch (error) {
        throw new Error(
          `Error saving doc in globalid \n\n${error.toString()}\n\n`
        );
      }
    },

    getDocument: function (params) {
      const doc = db.globalid.document(params);
      const docObj = globalIdDbo.initialize(doc);
      if (typeof docObj.onGetOne === 'function') {
        docObj.onGetOne();
      }

      return docObj;
    },

    firstExample: function (params) {
      const doc = db.globalid.firstExample(params);
      if (doc) {
        const docObj = globalIdDbo.initialize(doc);
        if (typeof docObj.onGetOne === 'function') {
          docObj.onGetOne();
        }
        return docObj;
      }
      return null;
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

      Object.defineProperty(obj, 'globalId', {
        get: () => {
          return globalIdDbo.globalId;
        },
      });

      Object.defineProperty(obj, 'instanceName', {
        get: () => {
          return 'globalIdDbo';
        },
      });

      Object.defineProperty(obj, 'keyProps', {
        get: () => {
          return obj.getKeyProps();
        },
      });

      if (typeof obj.afterInitialize === 'function') {
        obj.afterInitialize();
      }

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

        globalIdDbo.validateParams({
          ...this,
          ...updateValues,
          updatedAt: Date.now(),
        });
        const updatedDoc = db._update(
          this,
          { ...updateValues, updatedAt: Date.now() },
          { returnNew: true }
        ).new;
        this.reInitialize(updatedDoc);
      } else if (typeof callback === 'object') {
        globalIdDbo.validateParams({
          ...this,
          ...callback,
          updatedAt: Date.now(),
        });
        const updatedDoc = db._update(
          this,
          { ...callback, updatedAt: Date.now() },
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
  protypesString = `${protypesString}`.replace(
    /globalIdDbo/g,
    `${globalId}Dbo`
  );
  protypesString = `${protypesString}`.replace(/globalid/g, `${globalid}`);

  return `${objString}${methodsString}${protypesString}`;
};
