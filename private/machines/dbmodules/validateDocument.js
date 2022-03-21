const validateDocument = (docSchema, Doc) => {
  let errorString = '';

  function setError(error) {
    errorString += `${error}\n`;
  }

  const checkProp = ({ prop, propSchema, propValue, parentProp }) => {
    if (propSchema.type === 'string') {
      if (propSchema.enum) {
        if (!propSchema.enum.includes(propValue)) {
          setError(
            `Invalid value for property: ${
              parentProp ? `${parentProp}.` : ''
            }${prop}. Expected one of: ${propSchema.enum.join(
              ', '
            )} but got ${propValue}`
          );
        }
      }
    }

    if (propSchema.type === 'number') {
      if (typeof propValue !== 'number' || `${propValue}` === 'NaN') {
        setError(
          `Invalid value for property: ${
            parentProp ? `${parentProp}.` : ''
          }${prop}. Expected a number. but got ${`${propValue}`}`
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
  };

  function getAdditionalProps(schemaProperties, doc) {
    const docKeys = Object.keys(doc);
    const schemaKeys = Object.keys(schemaProperties);

    let additionalProps = [];

    for (let key of docKeys) {
      if (!schemaKeys.includes(key)) {
        additionalProps.push(key);
      }
    }

    return additionalProps;
  }

  function validate(schema, doc, parentProp) {
    let schemaProperties = schema.properties || {};
    let schemaRequired = schema.required || [];

    let additionalProperties = schema.additionalProperties;

    if (schema.rule && schema.rule.properties) {
      schemaProperties = schema.rule.properties;
      schemaRequired = schema.rule.required || [];
    }

    if (
      schema.rule &&
      (typeof schema.rule.additionalProperties === 'boolean' ||
        typeof schema.rule.additionalProperties === 'object')
    ) {
      additionalProperties = schema.rule.additionalProperties;
    }

    const additionalProps = getAdditionalProps(schemaProperties, doc);

    if (additionalProps.length >= 1 && additionalProperties === false) {
      throw new Error(`additionalProperties found ${additionalProps}`);
    }

    if (_.isObject(additionalProperties) && additionalProps.length >= 1) {
      let additionalSchema = {
        properties: {},
      };
      let docValue = {};
      for (let additionalProp of additionalProps) {
        additionalSchema.properties[additionalProp] = additionalProperties;
        docValue[additionalProp] = additionalProps[additionalProp];
      }

      validate(additionalSchema, docValue, parentProp);
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

    let docKeys = Object.keys(doc);

    for (let prop in schemaProperties) {
      let propSchema = schemaProperties[prop];
      let propValue = doc ? doc[prop] : null;

      if (!docKeys.includes(prop) && propSchema.required) {
        setError(
          `Missing required property: ${
            parentProp ? `${parentProp}.` : ''
          }${prop}${prop ? ` in field ${prop}.` : '.'}`
        );
      }

      if (!docKeys.includes(prop)) {
        docKeys = docKeys.filter((key) => key !== prop);
        continue;
      }
      docKeys = docKeys.filter((key) => key !== prop);

      if (propSchema.type === 'object' && !_.isEmpty(propValue)) {
        if (propSchema.properties) {
          validate(propSchema, propValue, prop);
        }

        const additionalProps = getAdditionalProps(
          propSchema.properties || {},
          propValue
        );

        const additionalProperties = propSchema.additionalProperties;

        if (additionalProps.length >= 1 && additionalProperties === false) {
          throw new Error(`additionalProperties found ${additionalProps}`);
        }

        if (_.isObject(additionalProperties) && additionalProps.length >= 1) {
          let additionalSchema = {
            properties: {},
          };
          let docValue = {};
          for (let additionalProp of additionalProps) {
            additionalSchema.properties[additionalProp] = additionalProperties;
            docValue[additionalProp] = propValue[additionalProp];
          }

          validate(additionalSchema, docValue, prop);
        }
      } else if (propSchema.type === 'array') {
        if (Array.isArray(propValue)) {
          if (propSchema.items) {
            if (propSchema.items.properties) {
              for (let item of propValue) {
                validate(propSchema.items, item, prop);
              }
            } else {
              for (let item of propValue) {
                checkProp({
                  prop,
                  propSchema: propSchema.items,
                  propValue: item,
                  parentProp,
                });
              }
            }
          }
        } else {
          setError(
            `Invalid value for property: ${
              parentProp ? `${parentProp}.` : ''
            }${prop}. Expected array.`
          );
        }
      } else {
        checkProp({
          propSchema,
          propValue,
          parentProp,
          prop,
        });
      }
    }
  }

  validate(docSchema, Doc);

  return errorString;
};

module.exports = String(validateDocument);
