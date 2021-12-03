const _ = require('@sailshq/lodash');
const getFilterStatement = require('./getFilterStatement');

// eslint-disable-next-line no-unused-vars
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
    .map((key) => `${key}:${stringify(obj_from_json[key])}`)
    .join(',');
  return `{${props}}`;
}

const getConcatStatements = (value) => {
  if (!_.isArray(value)) {
    return new Error('\n\n $contact attribute must be an array object \n\n');
  }

  return value
    .map((v) => {
      if (
        !`${v}`.includes('$') &&
        !`${v}`.includes("'") &&
        !`${v}`.includes('"')
      ) {
        return `record.${v}`;
      }
      return `${v}`.replace('$', '');
    })
    .join(', ');
};

const func = (f, value) => {
  const arangofunc = `${f}`.replace(/\$/, '').toUpperCase();

  if (arangofunc === 'CONCAT') {
    return `CONCAT(${getConcatStatements(value)})`;
  }

  const val = `${value}`.replace('$', '');

  if (_.includes(value, '$')) {
    return `${arangofunc}(${val})`;
  }
  return `${arangofunc}(record.${val})`;
};

const collectFn = (object) => {
  let st = '';
  _.each(object, (value, key) => {
    if (`${key}`.includes('$')) {
      st = func(key, value);
    } else {
      throw new Error(
        '\n\nCollect objects requires special dollar sign keys\n\n'
      );
    }
  });

  return `${JSON.stringify(st)}`.replace(/"/g, '');
};

const getCollectStatement = (collect) => {
  if (!_.isPlainObject(collect)) {
    return new Error('\n\n $aggregate && $collect attribute must be an object');
  }
  const statements = [];
  let st = '';

  const getStatemements = (key, value) => {
    switch (typeof value) {
      case 'string': {
        if (`${value}`.includes('$')) {
          return `${key} = ${`${value}`}`;
        }
        return `${key} = ${`record.${value}`}`;
      }
      case 'object': {
        return `${key} = ${collectFn(value)}`;
      }
      default:
        return '';
    }
  };

  _.each(collect, (value, key) => {
    statements.push(getStatemements(key, value));
    st = statements.filter((s) => !!s).join(', ');
  });

  return st;
};

const getIntoStatement = (value) => {
  let statements = [];
  let st = '';

  if (_.isString(value)) {
    st = `record.${value}`;
  }

  if (_.isObject(value)) {
    _.each(value, (val, key) => {
      statements = [...statements, `${key}: record.${val}`.replace(/"/g, '')];
    });

    st = `{${statements.join(', ')}}`;
  }

  return st;
};

const getSortStatement = (values) => {
  if (!_.isPlainObject(values)) {
    return new Error('\n\n Aggregate $return attribute must be an object');
  }
  const statements = [];

  const getStatemements = (key, value) => {
    if (!_.includes(['ASC', 'DESC'], value)) {
      return new Error(
        '\n\n Aggregate $sort attribute must be have either ASC or DESC'
      );
    }

    return `${`${key}`.replace('$', '')} ${value}`;
  };

  _.each(values, (value, key) => {
    statements.push(getStatemements(key, value));
  });

  return statements.filter((s) => !!s).join(', ');
};

const getReturnModifiers = (values) => {
  if (!_.isPlainObject(values)) {
    return new Error('\n\n Aggregate $return attribute must be an object');
  }
  let str = '';
  _.each(values, (value, key) => {
    str = func(key, value);
  });

  return str;
};

const getReturnStatement = (values) => {
  if (!_.isPlainObject(values)) {
    return new Error('\n\n Aggregate $return attribute must be an object');
  }
  const statement = values;

  const getStatemements = (value) =>
    `${value}`.includes('$') ? `${value}`.replace('$', '') : `record.${value}`;

  _.each(values, (value, key) => {
    if (_.isPlainObject(value)) {
      statement[key] = getReturnModifiers(value);
    } else {
      statement[key] = getStatemements(value);
    }
  });

  return `${JSON.stringify(values)}`.replace(/\\"/g, "'").replace(/"/g, '');
};

module.exports = ({ aggregateCriteria, pkColumnName, model }) => {
  if (!_.isPlainObject(aggregateCriteria) && !_.isArray(aggregateCriteria)) {
    return new Error('\n\n Aggregate collection attribute must be an object');
  }

  const { getAndStatement } = getFilterStatement({ pkColumnName });

  const aqlstatements = [];
  let criteriaarray = [];

  if (_.isPlainObject(aggregateCriteria)) {
    _.each(aggregateCriteria, (value, key) => {
      const cObj = {};
      cObj[`${key}`] = value;
      criteriaarray = [...criteriaarray, cObj];
    });
  } else {
    criteriaarray = [...aggregateCriteria];
  }

  const getAqlStatement = ({ value, key }) => {
    let aqlstatement = '';

    if (`${key}`.includes('$filter')) {
      aqlstatement = getAndStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `FILTER ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }

    if (key === '$collect') {
      aqlstatement = getCollectStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `COLLECT ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }

    if (key === '$intogroup') {
      aqlstatement = getIntoStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `INTO group = ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }
    if (key === '$withcountinto') {
      aqlstatement = `WITH COUNT INTO ${value}\n`;
      aqlstatements.push(aqlstatement);
    }

    if (key === '$aggregate') {
      aqlstatement = getCollectStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `AGGREGATE ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }

    if (key === '$let') {
      aqlstatement = getCollectStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `LET ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }

    if (key === '$sort') {
      aqlstatement = getSortStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `SORT ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }

    if (key === '$return') {
      aqlstatement = getReturnStatement(value || {});
      if (aqlstatement) {
        aqlstatement = `RETURN ${aqlstatement}\n`;
        aqlstatements.push(aqlstatement);
      }
    }
  };

  _.each(criteriaarray, (obj) => {
    _.each(obj, (value, key) => {
      getAqlStatement({ key, value });
    });
  });

  const statement = `FOR record in ${model} \n${aqlstatements.join('\n ')}`;

  return statement;
};
