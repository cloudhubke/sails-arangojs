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
    .map(key => `${key}:${stringify(obj_from_json[key])}`)
    .join(',');
  return `{${props}}`;
}

const func = (f, value) => {
  const arangofunc = `${f}`.replace(/\$/, '').toLocaleUpperCase();
  const val = `${value}`.replace('$', '');

  return `${arangofunc}(record.${val})`;
};

const aggregateFn = object => {
  let st = '';
  _.each(object, (value, key) => {
    st = func(key, value);
  });
  return st ? `${st}` : '';
};

const collectFn = object => {
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

const getCollectStatement = collect => {
  if (!_.isPlainObject(collect)) {
    return new Error('\n\n Aggregate $collect attribute must be an object');
  }
  const statements = [];
  let st = '';

  const getStatemements = (key, value) => {
    switch (typeof value) {
      case 'string': {
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
    st = statements.filter(s => !!s).join(', ');
  });

  return st;
};

const getIntoStatement = value => {
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

const getAggregateStatement = collect => {
  if (!_.isPlainObject(collect)) {
    return new Error('\n\n Aggregate $aggregate attribute must be an object');
  }
  const statements = [];

  const getStatemements = (key, value) => {
    switch (typeof value) {
      case 'string': {
        return value.includes('$')
          ? `${key} = ${`${value}`.replace('$', '')}`
          : `${key} = ${`record.${value}`}`;
      }
      case 'object': {
        return `${key} = ${aggregateFn(value)}`;
      }
      default:
        return '';
    }
  };

  _.each(collect, (value, key) => {
    statements.push(getStatemements(key, value));
  });

  return statements.filter(s => !!s).join(', ');
};

const getSortStatement = values => {
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

  return statements.filter(s => !!s).join(', ');
};

const getReturnModifiers = values => {
  if (!_.isPlainObject(values)) {
    return new Error('\n\n Aggregate $return attribute must be an object');
  }

  const getConcatStatements = value => {
    if (!_.isArray(value)) {
      return new Error('\n\n $contact attribute must be an object \n\n');
    }

    return value
      .map(v => (v.includes('$') ? `${v}`.replace('$', '') : `${v}`))
      .join(', ');
  };
  let str = '';
  _.each(values, (value, key) => {
    if (key === '$concat') {
      str = `${str} CONCAT(${getConcatStatements(value)})`;
    }
  });

  return str;
};

const getReturnStatement = values => {
  if (!_.isPlainObject(values)) {
    return new Error('\n\n Aggregate $return attribute must be an object');
  }
  const statement = values;

  const getStatemements = value => (`${value}`.includes('$') ? `${value}`.replace('$', '') : `${value}`);

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
  if (!_.isPlainObject(aggregateCriteria)) {
    return new Error('\n\n Aggregate collection attribute must be an object');
  }

  const { getAndStatement } = getFilterStatement({ pkColumnName });

  let filterstatement = '';
  let collectstatement = '';
  let intostatement = '';
  let withcountintostatement = '';
  let aggregatestatement = '';
  let returnstatement = '';
  let sortstatement = '';

  _.each(aggregateCriteria, (value, key) => {
    if (key === '$filter') {
      filterstatement = getAndStatement(value || {});
      if (filterstatement) {
        filterstatement = `FILTER ${filterstatement}\n`;
      }
    }
    if (key === '$collect') {
      collectstatement = getCollectStatement(value || {});
      if (collectstatement) {
        collectstatement = `COLLECT ${collectstatement}\n`;
      }
    }

    if (key === '$intogroup') {
      intostatement = getIntoStatement(value || {});
      if (intostatement) {
        intostatement = `INTO group = ${intostatement}\n`;
      }
    }
    if (key === '$withcountinto') {
      withcountintostatement = `WITH COUNT INTO ${value}\n`;
    }
    if (key === '$aggregate') {
      aggregatestatement = getAggregateStatement(value || {});
      if (aggregatestatement) {
        aggregatestatement = `AGGREGATE ${aggregatestatement}\n`;
      }
    }
    if (key === '$sort') {
      sortstatement = getSortStatement(value || {});
      if (sortstatement) {
        sortstatement = `SORT ${sortstatement}\n`;
      }
    }

    if (key === '$return') {
      returnstatement = getReturnStatement(value || {});
      if (returnstatement) {
        returnstatement = `RETURN ${returnstatement}\n`;
      }
    }
  });

  const statement = `FOR record in ${model} \n ${filterstatement}
  ${collectstatement}
  ${intostatement}
  ${withcountintostatement}
  ${aggregatestatement}
  ${sortstatement}
  ${returnstatement}`;

  return statement;
};
