const Ajv = require('ajv').default;

const ajv = new Ajv();

module.exports = function validateSchema(model, schema, document) {
  try {
    if (schema) {
      schema.type = 'object';
      const validate = ajv.compile(schema);

      const valid = validate(document);

      if (!valid) {
        console.log(`Schema validation failed for model ${model.tableName}`);
        console.log('====================================');

        let errors = '';
        for (let errorObject of validate.errors) {
          const fldName = `${errorObject.dataPath || model.tableName}`.split(
            '/'
          )[1];

          if (fldName) {
            console.log(
              `${fldName} | ${errorObject.message} but got: ${typeof document[
                fldName
              ]}`,
              {
                [fldName]: document[fldName],
                _key: document._key,
              }
            );
          } else {
            console.log(`${model.tableName} | ${errorObject.message}`);
            errors = `${errors}\n${model.tableName} |=> ${errorObject.message}`;
          }
        }
        console.log(validate.errors);
        throw new Error(
          `\nValidation of record for the model ${model.tableName} has failed\n${errors}`
        );
      }

      return valid;
    } else {
      return true;
    }
  } catch (error) {
    throw error;
  }
};
