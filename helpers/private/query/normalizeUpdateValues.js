const _ = require('@sailshq/lodash');
const SqlString = require('sqlstring');

const normalizeUpdateValues = values => {
  function specialValue(val) {
    if (_.isObject(val)) {
      return JSON.stringify(val)
        .replace(/"'/g, '')
        .replace(/'"/g, '')
        .replace(/\\/g, '');
    }
    if (_.isString(val)) {
      return `${SqlString.escape(val)}`;
    }
    if (Number(val)) {
      return val;
    }
    return val;
  }

  const getIncreaseValues = incvalues => {
    const st = {};
    if (_.isObject(incvalues)) {
      _.each(incvalues, (incvalue, key) => {
        if (!_.isNumber(incvalue)) {
          throw new Error(
            'Increment values in the `$inc` statement must be numbers'
          );
        } else {
          st[key] = `'OLD.${key}+${incvalue}'`;
        }
      });
    } else {
      throw new Error('The Values of the `$inc` statement must be an oject');
    }
    return st;
  };

  const getPushValues = (incvalues, unique) => {
    const st = {};
    if (_.isObject(incvalues)) {
      _.each(incvalues, (incvalue, key) => {
        st[key] = `'PUSH(OLD.${key}, ${specialValue(incvalue)}, ${unique})'`;
      });
    } else {
      throw new Error('The Values of the `$inc` statement must be an oject');
    }
    return st;
  };

  const getUnshiftValues = (incvalues, unique) => {
    const st = {};
    if (_.isObject(incvalues)) {
      _.each(incvalues, (incvalue, key) => {
        st[key] = `'UNSHIFT(OLD.${key}, ${specialValue(incvalue)}, ${unique})'`;
      });
    } else {
      throw new Error('The Values of the `$inc` statement must be an oject');
    }
    return st;
  };

  const getPopValues = incvalues => {
    const st = {};
    if (_.isObject(incvalues)) {
      _.each(incvalues, (incvalue, key) => {
        st[key] = `'POP(OLD.${key}'`;
      });
    } else {
      throw new Error('The Values of the `$inc` statement must be an oject');
    }
    return st;
  };

  const getShiftValues = incvalues => {
    const st = {};
    if (_.isObject(incvalues)) {
      _.each(incvalues, (incvalue, key) => {
        st[key] = `'POP(OLD.${key}'`;
      });
    } else {
      throw new Error('The Values of the `$inc` statement must be an oject');
    }
    return st;
  };

  const getPullValues = incvalues => {
    const st = {};
    if (_.isObject(incvalues)) {
      _.each(incvalues, (incvalue, key) => {
        if (_.isArray(incvalue)) {
          st[key] = `'REMOVE_VALUES(OLD.${key}, ${specialValue(incvalue)})'`;
        } else {
          throw new Error(
            'The Values of the `$pull` statement must be an Array oject'
          );
        }
      });
    } else {
      throw new Error('The Values of the `$inc` statement must be an oject');
    }
    return st;
  };

  const getAndOrValues = andorvalues => {
    let st = {};
    if (_.isArray(andorvalues)) {
      _.each(andorvalues, val => {
        st = { ...st, ...val };
      });
    } else {
      throw new Error('The Values of the `$and` statement must be an oject');
    }
    return st;
  };

  let newvalues = {};

  _.each(values, (value, key) => {
    switch (key) {
      case '$inc':
        newvalues = { ...newvalues, ...getIncreaseValues(value) };
        break;
      case '$pop':
        newvalues = { ...newvalues, ...getPopValues(value) };
        break;
      case '$shift':
        newvalues = { ...newvalues, ...getShiftValues(value) };
        break;
      case '$unshift':
        newvalues = { ...newvalues, ...getUnshiftValues(value, false) };
        break;
      case '$unshiftset':
        newvalues = { ...newvalues, ...getUnshiftValues(value, false) };
        break;
      case '$push':
        newvalues = { ...newvalues, ...getPushValues(value, false) };
        break;
      case '$pushset':
        newvalues = { ...newvalues, ...getPushValues(value, true) };
        break;
      case '$pull':
        newvalues = { ...newvalues, ...getPullValues(value) };
        break;
      case 'and':
        newvalues = { ...newvalues, ...getAndOrValues(value) };
        break;
      case '$and':
        newvalues = { ...newvalues, ...getAndOrValues(value) };
        break;
      default:
        newvalues = { ...newvalues, [key]: value };
        break;
    }
  });

  return newvalues;
};

module.exports = normalizeUpdateValues;
