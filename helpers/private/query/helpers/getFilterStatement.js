const SqlString = require('sqlstring');
const _ = require('@sailshq/lodash');

module.exports = ({ pkColumnName }) => {
  function specialValue(val, key) {
    if (`${val}`.includes('(record.')) {
      return val;
    }
    if (`${val}`.slice(0, 1) === '$') {
      return `${val}`.replace('$', '');
    }

    if (key === pkColumnName) {
      return `${SqlString.escape(val)}`;
    }
    if (_.isObject(val)) {
      return JSON.stringify(val);
    }
    if (_.isString(val)) {
      return `${SqlString.escape(`${val}`.trim())}`;
    }
    if (Number(val)) {
      return val;
    }
    return val;
  }

  function getInStatement(arr) {
    let str = '';
    if (Array.isArray(arr) && arr.length > 0) {
      if (arr.length === 1) {
        const v = arr[0];
        str = `== ${specialValue(v)}`;
      } else {
        const elements = arr.map((v) => (typeof v === 'string' ? `'${v}'` : v));
        str = `IN [${elements}]`;
      }
    } else {
      throw new Error('the IN statement expects an array of values.');
    }

    return str;
  }

  function getAllInStatement(arr) {
    let str = '';
    if (Array.isArray(arr) && arr.length > 0) {
      const elements = arr.map((v) => (typeof v === 'string' ? `'${v}'` : v));
      str = `ALL IN [${elements}]`;
    } else {
      throw new Error('the IN statement expects an array of values.');
    }

    return str;
  }

  function getAnyInStatement(arr) {
    let str = '';
    if (Array.isArray(arr) && arr.length > 0) {
      const elements = arr.map((v) => (typeof v === 'string' ? `'${v}'` : v));
      str = `ANY IN [${elements}]`;
    } else {
      throw new Error('the IN statement expects an array of values.');
    }

    return str;
  }

  function getHasStatement(val) {
    let str = '';
    if (_.isString(val) || _.isNumber(val)) {
      str = `${specialValue(val)}`;
    } else {
      throw new Error('the HAS statement expects a number or string.');
    }
    return str;
  }

  function getNotHasStatement(val) {
    let str = '';
    if (_.isString(val) || _.isNumber(val)) {
      str = `${specialValue(val)}`;
    } else {
      throw new Error('the NOT HAS statement expects a number or string.');
    }
    return str;
  }

  function getNotInStatement(arr) {
    let str = '';
    if (Array.isArray(arr) && arr.length > 0) {
      if (arr.length === 1) {
        const v = arr[0];
        str = `!= ${specialValue(v)}`;
      } else {
        const elements = arr.map((v) => (typeof v === 'string' ? `'${v}'` : v));
        str = `NOT IN [${elements}]`;
      }
    } else {
      throw new Error('the IN statement expects an array of values.');
    }

    return str;
  }

  function getBetweenStatement(arr) {
    const btwn = [];
    if (Array.isArray(arr) && arr.length === 2) {
      btwn.push(arr[0]);
      btwn.push(arr[1]);
    } else {
      throw new Error(
        'An array of two values is expected in the BETWEEN criteria'
      );
    }
    return `BETWEEN ${btwn.join(' AND ')}`;
  }

  function getComparison(obj) {
    if (_.isEmpty(obj)) {
      return '';
    }
    let str = null;
    _.each(obj, (value, key) => {
      switch (`${key}`.toLowerCase()) {
        case '$gt':
          str = `> ${value}`;
          return;
        case '$gte':
          str = `>= ${value}`;
          return;
        case '$lt':
          str = `< ${value}`;
          return;
        case '$lte':
          str = `<= ${value}`;
          return;
        case '$ne':
          str = `!= ${specialValue(value)}`;
          return;

        case '>':
          str = `> ${specialValue(value)}`;
          return;
        case '>=':
          str = `>= ${specialValue(value)}`;
          return;
        case '<':
          str = `< ${value}`;
          return;
        case '<=':
          str = `<= ${value}`;
          return;
        case '<>':
          str = `!= ${specialValue(value)}`;
          return;
        case '!=':
          str = `!= ${specialValue(value)}`;
          return;

        case 'like':
          str = `LIKE ${`${specialValue(value)}`.toLowerCase()}`;
          return;
        case '$like':
          str = `LIKE ${`${specialValue(value)}`.toLowerCase()}`;
          return;

        case 'notlike':
          str = `NOT LIKE ${`${specialValue(value)}`.toLowerCase()}`;
          return;
        case '$notlike':
          str = `NOT LIKE ${`${specialValue(value)}`.toLowerCase()}`;
          return;

        case '$in':
          str = getInStatement(value);
          return;
        case 'in':
          str = getInStatement(value);
          return;
        case '$allin':
          str = getAllInStatement(value);
          return;
        case '$anyin':
          str = getAnyInStatement(value);
          return;

        case '$has':
          str = getHasStatement(value);
          return;
        case '$nothas':
          str = getNotHasStatement(value);
          return;
        case '$nin':
          str = getNotInStatement(value);
          return;
        case 'nin':
          str = getNotInStatement(value);
          return;
        case '$between':
          str = getBetweenStatement(value);
          return;
        default:
          str = null;
      }
    });
    return str;
  }

  function getAndStatement(obj) {
    const criteria = [];
    const str = null;
    if (_.isEmpty(obj)) {
      return '';
    }
    _.each(obj, (value, key) => {
      const keystr = `${key}`.replace(/ /g, '');

      if (key.toLowerCase() === '$or' || key.toLowerCase() === 'or') {
        // eslint-disable-next-line no-use-before-define
        criteria.push(`(${getOrStatement(value)})`);
        return;
      }

      if (key.toLowerCase() === 'and' || key.toLowerCase() === '$and') {
        // eslint-disable-next-line no-use-before-define
        criteria.push(`(${getAndArrayStatement(value)})`);
        return;
      }

      if (key.toLowerCase() === '$between' || key.toLowerCase() === 'between') {
        criteria.push(`BETWEEN ${getAndStatement(value)}`);
        return;
      }

      // if (_.isArray(value)) {
      //   let inarr = '';
      //   if (value.length === 1) {
      //     const v = value[0];
      //     inarr = `== ${specialValue(v)}`;
      //   }
      //   inarr = `IN [${value.map((v) => specialValue(v))}]`;
      //   criteria.push(inarr);
      //   return;
      // }

      if (_.isObject(value)) {
        if (_.has(value, '$has') || _.has(value, 'has')) {
          criteria.push(`${getComparison(value)} IN record.${key} `);
          return;
        }

        if (_.has(value, '$nothas') || _.has(value, 'nothas')) {
          criteria.push(`${getComparison(value)} NOT IN record.${key} `);
          return;
        }

        if (
          _.has(value, '$like') ||
          _.has(value, 'like') ||
          _.has(value, '$notlike') ||
          _.has(value, 'notlike')
        ) {
          criteria.push(`LOWER(record.${key}) ${getComparison(value)}`);
          return;
        }

        if (`${keystr}`.includes('(record.') || `${keystr}`.includes('$')) {
          criteria.push(
            `${`${keystr}`.replace('$', '')} ${getComparison(value)}`
          );
        } else {
          criteria.push(`record.${key} ${getComparison(value)}`);
        }

        return;
      }

      if (`${keystr}`.includes('(record.') || `${keystr}`.includes('$')) {
        criteria.push(
          `${`${keystr}`.replace('$', '')} == ${specialValue(value, key)}`
        );
      } else {
        criteria.push(`record.${key} == ${specialValue(value, key)}`);
      }
    });

    if (str) {
      return str;
    }

    return criteria.join(' AND ');
  }

  function getOrStatement(arr) {
    const orst = [];
    if (Array.isArray(arr) && arr.length > 1) {
      _.each(arr, (obj) => {
        orst.push(getAndStatement(obj));
      });
    } else {
      throw new Error(
        'We expect an array of more than one objects on the OR criteria'
      );
    }
    return orst.join(' OR ');
  }

  function getAndArrayStatement(arr) {
    const andst = [];
    if (Array.isArray(arr)) {
      _.each(arr, (obj) => {
        andst.push(getAndStatement(obj));
      });
    } else {
      throw new Error('We expect an array in the AND criteria');
    }
    return andst.join(' AND ');
  }

  function getLetStatements(obj) {
    let str = '';

    for (const key in obj) {
      let val = obj[key];
      // if(_.isObject(obj) || _.isArray(obj)){

      // }
      if (`${val}`.slice(0, 1) === '$' && !`${val}`.includes('$record.')) {
        val = `${val}`.replace('$', ' $');
      }
      str = `${str}LET ${key} = ${specialValue(val)}\n`;
    }

    return str;
  }

  return {
    getAndStatement,
    getLetStatements,
  };
};
