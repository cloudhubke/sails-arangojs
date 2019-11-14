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

  if (obj_from_json === null || obj_from_json === undefined) {
    return null;
  }

  const props = Object.keys(obj_from_json)
    .map(key => `${key}:${stringify(obj_from_json[key])}`)
    .join(',');
  return `{${props}}`;
}

const stringifyUpdateValues = (values, method) => {
  function specialValue(val) {
    if (_.isObject(val)) {
      return stringify(val).replace(/'/g, '');
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
        'Increment values in the `$inc` statement must be numbers'
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
        'The Values of the `$inc` statement must be a valid value'
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
        'The Values of the `$inc` statement must be a valid value'
      );
    }
    return st;
  };

  const getPopValues = (key, value) => {
    let st;
    if (value) {
      st = `POP(OLD.${key})`;
    } else {
      throw new Error(
        'The Values of the `$inc` statement must be a valid value'
      );
    }
    return st;
  };

  const getShiftValues = (key, value) => {
    let st = '';
    if (value) {
      st = `SHIFT(OLD.${key})`;
    } else {
      throw new Error(
        'The Values of the `$inc` statement must be a valid value'
      );
    }

    return st;
  };

  const getPullValues = (key, value) => {
    let st;
    if (_.isArray(value)) {
      st = `REMOVE_VALUES(OLD.${key}, ${specialValue(value)})`;
    } else {
      throw new Error(
        'The Values of the `$pull` statement must be an Array oject'
      );
    }

    return st;
  };

  let newvalues = [];

  const getAndOrValues = andorvalues => {
    let st = [];
    if (_.isArray(andorvalues)) {
      _.each(andorvalues, val => {
        _.each(val, (value, key) => {
          if (method === 'upsert') {
            if (_.includes(key, '.')) {
              throw new Error(
                '\n\n\nThe the upsert statement cannot include deep nested search\n\n\n'
              );
            }
          }
          st = [...st, `${key}: ${specialValue(value)}`];
        });
      });
    } else {
      throw new Error(
        'The Values of the `$and` statement must be an array of objects'
      );
    }
    return st;
  };

  _.each(values, (value, key) => {
    if (_.isPlainObject(value)) {
      if (_.isEmpty(value)) {
        if (_.isArray(value)) {
          newvalues = [...newvalues, `${key}: []`];
        } else {
          newvalues = [...newvalues, `${key}: {}`];
        }
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
      switch (key) {
        case 'and':
          newvalues = [...newvalues, ...getAndOrValues(value)];
          break;
        case '$and':
          newvalues = [...newvalues, ...getAndOrValues(value)];
          break;
        default:
          newvalues = [...newvalues, `${key}: ${specialValue(value)}`];
          break;
      }
    }
  });

  return `{${newvalues.join(', ')}}`;
};

module.exports = stringifyUpdateValues;
