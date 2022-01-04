const validateDocument = (docSchema, Doc) => {
  let errorString = '';

  function setError(error) {
    errorString += `${error}\n`;
  }

  function validate(schema, doc, parentProp) {
    let schemaProperties = schema.properties;
    let schemaRequired = schema.required || [];

    if (schema.rule && schema.rule.properties) {
      schemaProperties = schema.rule.properties;
      schemaRequired = schema.rule.required || [];
    }

    for (let required of schemaRequired) {
      if (!doc) {
        return setError(
          `Missing required property: ${required}${
            parentProp ? ` in field ${parentProp}.` : '.'
          }`
        );
      }
      if (typeof doc[required] === 'undefined' || doc[required] === null) {
        setError(
          `Missing required property: ${required}${
            parentProp ? ` in field ${parentProp}.` : '.'
          }`
        );
      }
    }

    for (let prop in schemaProperties) {
      let propSchema = schemaProperties[prop];
      let propValue = doc ? doc[prop] : null;

      const docKeys = Object.keys(doc);

      if (!docKeys.includes(prop) && propSchema.required) {
        setError(
          `Missing required property: ${
            parentProp ? `${parentProp}.` : ''
          }${prop}${prop ? ` in field ${prop}.` : '.'}`
        );
      }

      if (!docKeys.includes(prop)) {
        continue;
      }

      if (propSchema.type === 'string') {
        if (propSchema.enum) {
          if (!propSchema.enum.includes(propValue)) {
            setError(
              `Invalid value for property: ${
                parentProp ? `${parentProp}.` : ''
              }${prop}. Expected one of: ${propSchema.enum.join(', ')}`
            );
          }
        }
      }

      if (propSchema.type === 'number') {
        if (propValue && typeof propValue !== 'number') {
          setError(
            `Invalid value for property: ${
              parentProp ? `${parentProp}.` : ''
            }${prop}. Expected a number.`
          );
        }

        if (propSchema.enum) {
          if (!propSchema.enum.includes(propValue)) {
            setError(
              `Invalid value for property: ${
                parentProp ? `${parentProp}.` : ''
              }${prop}. Required one of: ${propSchema.enum.join(', ')}`
            );
          }
        }

        if (typeof propSchema.minimum === 'number') {
          if (propValue < propSchema.minimum) {
            setError(
              `Invalid value for property: ${
                parentProp ? `${parentProp}.` : ''
              }${prop}. Minimum value is ${propSchema.minimum}`
            );
          }
        }

        if (typeof propSchema.maximum === 'number') {
          if (propValue > propSchema.maximum) {
            setError(
              `Invalid value for property: ${
                parentProp ? `${parentProp}.` : ''
              }${prop}. Maximum value is ${propSchema.maximum}`
            );
          }
        }
      }

      if (propSchema.type === 'boolean') {
        if (propValue !== true && propValue !== false) {
          setError(
            `Invalid value for property: ${
              parentProp ? `${parentProp}.` : ''
            }${prop}. Expected boolean value`
          );
        }
      }

      if (propSchema.type === 'object' && !_.isEmpty(propValue)) {
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
