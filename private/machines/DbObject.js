function getObject(globalId) {
  return `//${`${globalId}Dbo`.toUpperCase()} \n   
  
  ${String(global[`${globalId}Dbo`])}`;
}

module.exports = ({
  globalId,
  tableName,
  keyProps,
  modelDefaults,
  schema,
  modelAttributes,
}) => {
  const globalid = `${globalId}`.toLowerCase();

  const methods = () => ({
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // STATIC METHODS
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    globalId: `"${globalId}"`,
    tableName: `"${tableName}"`,
    keyProps: JSON.stringify(keyProps),
    modelDefaults: JSON.stringify(modelDefaults || {}),
    modelAttributes: JSON.stringify(modelAttributes || {}),
    getSchema: function () {
      const tableName = globalIdDbo.tableName;

      if (globalIdDbo.schema) {
        return globalIdDbo.schema;
      } else {
        globalIdDbo.schema = db
          ._query(`RETURN SCHEMA_GET('${tableName}')`)
          .toArray()[0];

        return globalIdDbo.schema;
      }
    },
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
          docParams[key] !== null &&
          typeof docParams[key] !== type
        ) {
          throw new Error(
            `${key} attribute in ${
              globalIdDbo.globalId
            } should be of type ${type} - ${docParams._key || ''}`
          );
        }

        if (
          (!Object.keys(docParams).includes(key) || docParams[key] === null) &&
          required
        ) {
          throw new Error(
            `${key} attribute in ${globalIdDbo.globalId} is required - ${
              docParams._key || ''
            }`
          );
        }

        if (isIn && type === 'string' && !isIn.includes(docParams[key])) {
          throw new Error(
            `${key} attribute (${type}) in ${
              globalIdDbo.globalId
            } should be one of ${isIn.join(', ')}. But found ${
              docParams[key]
            } - ${docParams._key || ''}`
          );
        }

        if (isIn && type === 'object') {
          _.each(docParams[key], (str) => {
            if (!isIn.includes(str)) {
              throw new Error(
                `${key} attribute (${type}) in ${
                  globalIdDbo.globalId
                } should be one of ${isIn.join(', ')}. But found ${str} - ${
                  docParams._key || ''
                }`
              );
            }
          });
        }

        for (rule in rules) {
          if (rule === 'minimum') {
            if (docParams[key] < rules[rule]) {
              throw new Error(
                `${key} should not be less than ${rules[rule]} - its ${
                  docParams[key]
                } in ${docParams._key || ''}`
              );
            }
          }
          if (rule === 'maximum') {
            if (docParams[key] > rules[rule]) {
              throw new Error(
                `${key} should not be more than ${rules[rule]} -  its ${
                  docParams[key]
                } in ${docParams._key || ''}`
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

        const docObj = globalIdDbo.initialize(doc, true);

        return docObj;
      } catch (error) {
        const response = error.response || {};

        const errorStr = error.toString();

        let validationErrors = '';
        let schema;
        if (errorStr.includes('Schema violation')) {
          schema = globalIdDbo.getSchema();
          validationErrors = dbmodules.validateDocument(schema, docParams);
        }

        throw new Error(
          `Error saving doc in globalid\n\n ${
            validationErrors ||
            `${errorStr}\n\n ${JSON.stringify(docParams)}\n\n`
          }`
        );
      }
    },

    getDocument: function (params, options = { fireOnGetOne: true }) {
      const doc = db.globalid.document(params);
      const docObj = globalIdDbo.initialize(doc, options.fireOnGetOne);

      return docObj;
    },

    find: function (params = {}, options = {}) {
      const { getAndStatement, getLetStatements } = dbmodules.filterStatement();
      // Execute aql using the driver acquired dbConnectio.
      let aql = `FOR record in globalid \n`;

      if (options.let) {
        aql = `${aql}${getLetStatements(options.let)} \n`;
      }

      if (!_.isEmpty(params)) {
        aql = `${aql} FILTER ${getAndStatement(params)} \n`;
      }

      if (options.sort) {
        let str = '';
        _.each(options.sort, (value, key) => {
          str += `record.${key} ${value}`;
        });
        aql = `${aql} SORT ${str} \n`;
      }

      if (options.limit) {
        if (options.skip) {
          aql = `${aql} LIMIT ${options.skip}, ${options.limit} \n`;
        } else {
          aql = `${aql} LIMIT ${options.limit} \n`;
        }
      }
      aql = `${aql} return record`;

      return db._query(aql);
    },

    findOne: function (params, options = { fireOnGetOne: true }) {
      const { getAndStatement, getLetStatements } = dbmodules.filterStatement();

      const aql = `FOR record in globalid FILTER ${getAndStatement(
        params
      )} RETURN record`;

      const results = db._query(aql).toArray();
      if (results.length > 1) {
        throw new Error(`More than one record found`);
      }
      if (results[0]) {
        const docObj = globalIdDbo.initialize(results[0], options.fireOnGetOne);
        return docObj;
      }
      return null;
    },

    firstExample: function (params, options = { fireOnGetOne: true }) {
      const doc = db.globalid.firstExample(params);
      if (doc) {
        const docObj = globalIdDbo.initialize(doc, options.fireOnGetOne);
        return docObj;
      }
      return null;
    },

    initialize: function (doc, fireOnGetOne = false) {
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

      if (fireOnGetOne && typeof obj.onGetOne === 'function') {
        obj.onGetOne();
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
        this.id = doc._key;
      }
    },
    update: function (callback, options = {}) {
      if (typeof callback === 'function') {
        const updateValues = callback(this);
        try {
          globalIdDbo.validateParams({
            ...this,
            ...updateValues,
            updatedAt: Date.now(),
          });
          const updatedDoc = db._update(
            { _id: this._id },
            { ...updateValues, updatedAt: Date.now() },
            { ...options, returnNew: true }
          ).new;
          this.reInitialize(updatedDoc);
        } catch (error) {
          let validationErrors = '';
          if (errorStr.includes('Schema violation')) {
            const schema = globalIdDbo.getSchema();
            validationErrors = dbmodules.validateDocument(schema, updateValues);
          }

          // show errors
          throw new Error(
            `Error saving doc in globalid \n\n${
              validationErrors ||
              `${errorStr}\n\n ${JSON.stringify(updateValues)}\n\n`
            }`
          );
        }
      } else if (typeof callback === 'object') {
        const newDoc = { ...this, ...callback, updatedAt: Date.now() };
        try {
          globalIdDbo.validateParams(newDoc);
          const updatedDoc = db._update({ _id: this._id }, newDoc, {
            ...options,
            returnNew: true,
          }).new;
          this.reInitialize(updatedDoc);
        } catch (error) {
          const errorStr = error.toString();
          let validationErrors = '';
          if (errorStr.includes('Schema violation')) {
            const schema = globalIdDbo.getSchema();
            validationErrors = dbmodules.validateDocument(schema, newDoc);
          }

          throw new Error(
            `Error saving doc in globalid\n\n${
              validationErrors ||
              `${errorStr}\n\n ${JSON.stringify(newDoc)}\n\n`
            }`
          );
        }
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

  // console.log('====================================');
  // console.log(`${objString}${methodsString}${protypesString}`);
  // console.log('====================================');

  return `${objString}${methodsString}${protypesString}`;
};
