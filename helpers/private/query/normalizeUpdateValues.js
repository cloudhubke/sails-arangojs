// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// this method was created to accomodate statements like $inc
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const _ = require('@sailshq/lodash');
const SqlString = require('sqlstring');

function stringify(obj_from_json) {
  if (typeof obj_from_json !== 'object' || Array.isArray(obj_from_json)) {
    // not an object, stringify using native function
    return JSON.stringify(obj_from_json);
  }
  // Implements recursive object serialization according to JSON spec
  // but without quotes around the keys.
  const props = Object.keys(obj_from_json)
    .map(key => `${key}:${stringify(obj_from_json[key])}`)
    .join(',');
  return `{${props}}`;
}

const normalizeUpdateValues = (values) => {
  function specialValue(val) {
    if (_.isObject(val)) {
      return stringify(val).replace(/\'/g, '');
    }
    if (_.isString(val)) {
      return `${SqlString.escape(val)}`;
    }
    if (Number(val)) {
      return val;
    }
    return val;
  }

  const getIncreaseValues = (key, incvalue) => {
    let st = '';
    if (!_.isNumber(incvalue)) {
      throw new Error(
        'Increment values in the `$inc` statement must be numbers',
      );
    } else {
      st = `OLD.${key}+${incvalue}`;
    }
    return st;
  };

  const getPushValues = (key, value, unique) => {
    let st;
    if (value) {
      if (_.isObject(value)) {
        st = `PUSH(OLD.${key}, ${specialValue(value)}, ${unique})`;
      } else {
        st = `PUSH(OLD.${key}, ${specialValue(value)}, ${unique})`;
      }
    } else {
      throw new Error(
        'The Values of the `$inc` statement must be a valid value',
      );
    }
    return st;
  };

  const getUnshiftValues = (key, value, unique) => {
    let st;
    if (value) {
      st = `UNSHIFT(OLD.${key}, ${specialValue(value)}, ${unique})`;
    } else {
      throw new Error(
        'The Values of the `$inc` statement must be a valid value',
      );
    }
    return st;
  };

  const getPopValues = (key, value) => {
    let st;
    if (value) {
      st = `POP(OLD.${key}`;
    } else {
      throw new Error(
        'The Values of the `$inc` statement must be a valid value',
      );
    }
    return st;
  };

  const getShiftValues = (key, value) => {
    let st = '';
    if (value) {
      st = `POP(OLD.${key}`;
    } else {
      throw new Error(
        'The Values of the `$inc` statement must be a valid value',
      );
    }

    return st;
  };

  const getPullValues = (key, value) => {
    let st;
    if (_.isArray(values)) {
      st = `REMOVE_VALUES(OLD.${key}, ${specialValue(value)})`;
    } else {
      throw new Error(
        'The Values of the `$pull` statement must be an Array oject',
      );
    }

    return st;
  };

  let newvalues = [];

  _.each(values, (value, key) => {
    if (_.isPlainObject(value)) {
      if (_.keys(value).length > 1) {
        throw new Error(
          '\n\nUpdate level cannot be more that one level deep. \n\n',
        );
      }
      _.each(value, (v, k) => {
        switch (k) {
          case '$inc':
            newvalues = [...newvalues, `${key}: ${getIncreaseValues(key, v)}`];
            break;
          case '$pop':
            newvalues = [...newvalues, `${key}: ${getPopValues(key, v)}`];
            break;
          case '$shift':
            newvalues = [...newvalues, `${key}: ${getShiftValues(key, v)}`];
            break;
          case '$unshift':
            newvalues = {
              ...newvalues,
              [key]: getUnshiftValues(key, v, false),
            };
            break;
          case '$unshiftset':
            newvalues = {
              ...newvalues,
              [key]: getUnshiftValues(key, v, false),
            };
            break;
          case '$push':
            newvalues = [
              ...newvalues,
              `${key}: ${getPushValues(key, v, false)}`,
            ];
            break;
          case '$pushset':
            newvalues = [
              ...newvalues,
              `${key}: ${getPushValues(key, v, true)}`,
            ];
            break;
          case '$pull':
            newvalues = [...newvalues, `${key}: ${getPullValues(key, v)}`];
            break;
          default:
            newvalues = [...newvalues, `${key}: ${specialValue(value)}`];
            break;
        }
      });
    } else {
      newvalues = [...newvalues, `${key}: ${specialValue(value)}`];
    }
  });
  return `{${newvalues.join(', ')}}`;
};

module.exports = normalizeUpdateValues;
