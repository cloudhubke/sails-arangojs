const validateDocument = (docSchema, Doc) => {
  let errorString = '';

  function setError(error) {
    errorString += `${error}\n`;
  }

  function validate(schema, doc, prop) {
    let schemaProperties = schema.properties;
    let schemaRequired = schema.required || [];

    if (schema.rule && schema.rule.properties) {
      schemaProperties = schema.rule.properties;
      schemaRequired = schema.rule.required || [];
    }

    for (let required of schemaRequired) {
      if (typeof doc[required] === 'undefined') {
        setError(
          `Missing required property: ${required}${
            prop ? ` in field ${prop}.` : '.'
          }`
        );
      }
    }

    for (let prop in schemaProperties) {
      let propSchema = schemaProperties[prop];
      let propValue = doc[prop];

      console.log(prop, propValue);

      if (propSchema.type === 'string') {
        if (propSchema.enum) {
          if (!propSchema.enum.includes(propValue)) {
            setError(
              `Invalid value for property: ${prop}. Expected one of: ${propSchema.enum.join(
                ', '
              )}`
            );
          }
        }
      }

      if (propSchema.type === 'number') {
        if (propSchema.enum) {
          if (!propSchema.enum.includes(propValue)) {
            setError(
              `Invalid value for property: ${prop}. Required one of: ${propSchema.enum.join(
                ', '
              )}`
            );
          }
        }

        if (propSchema.minimum) {
          if (propValue < propSchema.minimum) {
            setError(
              `Invalid value for property: ${prop}. Minimum value is ${propSchema.minimum}`
            );
          }
        }

        if (propSchema.maximum) {
          if (propValue > propSchema.maximum) {
            setError(
              `Invalid value for property: ${prop}. Maximum value is ${propSchema.maximum}`
            );
          }
        }
      }

      if (propSchema.type === 'boolean') {
        if (propValue !== true && propValue !== false) {
          setError(
            `Invalid value for property: ${prop}. Expected boolean value`
          );
        }
      }

      if (propSchema.type === 'object') {
        if (propSchema.properties) {
          validate(propSchema, propValue, prop);
        }
      }

      if (propSchema.type === 'array') {
        if (propSchema.items) {
          for (let item of propValue) {
            validate(propSchema.items, item, prop);
          }
        }
      }
    }
  }

  validate(docSchema, Doc);

  return errorString;
};

module.exports = String(validateDocument);
