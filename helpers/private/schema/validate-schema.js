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
        for (let errorObject of validate.errors) {
          const fldName = `${errorObject.dataPath}`.split('/')[1];
          console.log(
            `${fldName} | ${errorObject.message} but got: ${typeof document[
              fldName
            ]}`,
            {
              [fldName]: document[fldName],
              _key: document._key,
            }
          );
        }
        console.log(validate.errors);
        throw new Error(
          `\n\Sanitization of the model ${model.tableName} has failed\n\n`
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
