/* eslint-disable no-use-before-define */
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Sync function that returns a friendly sql statement for easy manipulation in the ArangoJs driver
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const _ = require('@sailshq/lodash');

const normalizeUpdateValues = require('./normalizeUpdateValues');
const stringifyUpdateValues = require('./stringifyUpdateValues');

const getFilterStatement = require('./helpers/getFilterStatement');

module.exports = function compileStatement(options) {
  const {
    model,
    method,
    numericAttrName,
    values,
    pkColumnName,
    edgeCollections,
    distanceCriteria,
    aggregateCriteria,
  } = options;

  if (!pkColumnName) {
    throw new Error(
      'SQL Statement cannot compile because the pkColumnName is not passed'
    );
  }

  const passedcriteria = options.criteria || {};

  const primarywhere = { ...(passedcriteria.where || {}) };

  if (primarywhere[pkColumnName] && !primarywhere._id) {
    primarywhere._id = `${model}/${primarywhere[pkColumnName]}`;
  }

  if (passedcriteria.whereVertex) {
    if (_.isString(passedcriteria.whereVertex)) {
      passedcriteria.whereVertex = {
        [pkColumnName]: passedcriteria.whereVertex,
      };
    }
  }

  if (passedcriteria.whereEdge) {
    if (_.isString(passedcriteria.whereEdge)) {
      passedcriteria.whereEdge = { [pkColumnName]: passedcriteria.whereEdge };
    }
  }

  // Hold the final query value

  // Validate options
  if (!model) {
    throw new Error('Convert must contain a model to use to build the query.');
  }

  if (!method) {
    throw new Error('Convert must contain a method to use to build the query.');
  }

  // Validate Criteria Input is a dictionary
  if (passedcriteria && !_.isPlainObject(passedcriteria)) {
    throw new Error('Criteria must be a dictionary.');
  }

  // Validate Criteria Input contains a WHERE clause
  if (
    passedcriteria &&
    _.keys(passedcriteria).length &&
    !_.has(passedcriteria, 'where')
  ) {
    throw new Error('Criteria must contain a WHERE clause.');
  }

  const { getAndStatement, getLetStatements } = getFilterStatement({
    pkColumnName,
  });

  function hasSelectFields() {
    if (
      _.isEqual(passedcriteria.select, ['*']) ||
      _.isEqual(passedcriteria.select, '*')
    ) {
      return false;
    }
    if (Array.isArray(passedcriteria.select)) {
      if (passedcriteria.select.length > 0) {
        return true;
      }
    }
    return false;
  }

  function selectAttributes(vals) {
    if (vals && Array.isArray(vals)) {
      let fields = [...vals].filter((f) => {
        const arr = [
          'sort',
          'limit',
          'skip',
          'select',
          'filter',
          'like',
          'notlike',
          'not',
          'in',
          'for',
          'return',
          'search',
          'let',
          'collect',
          'remove',
          'update',
          'replace',
          'insert',
          'upsert',
          'with',
          'all',
          'distinct',
          'outbound',
          'any',
          'into',
          'none',
        ];
        return !_.includes(arr, f);
      });
      if (!_.includes(fields, pkColumnName)) {
        fields = [...vals, pkColumnName];
      }
      return fields;
    }

    return [pkColumnName];
  }

  function getNumericAttrName() {
    if (Array.isArray(numericAttrName)) {
      return numericAttrName.map((n) => `record.${n}`).join(' + ');
    }
    if (numericAttrName) {
      return numericAttrName;
    }
    return null;
  }

  function getEdgeCollections() {
    if (Array.isArray(edgeCollections)) {
      return edgeCollections.map((n) => n).join(', ');
    }
    if (edgeCollections) {
      return edgeCollections;
    }
    return null;
  }

  function getGeoAttrName() {
    let attrName;
    if (distanceCriteria) {
      _.each(distanceCriteria, (value, key) => {
        if (key !== 'radius') {
          attrName = key;
        }
      });
    }
    return attrName;
  }

  function getGeoRadius() {
    let radius = 0;
    if (distanceCriteria) {
      _.each(distanceCriteria, (value, key) => {
        if (key === 'radius') {
          radius = Number(value || 0);
        }
      });
    }
    return radius;
  }

  function getDistanceCriteria() {
    let criteria = '';
    if (distanceCriteria) {
      _.each(distanceCriteria, (value, key) => {
        if (key !== 'radius') {
          criteria = `${value.longitude}, ${value.latitude}`;
        }
      });
    }
    return criteria;
  }

  // Check for sort
  let sortClauseArray = [];
  if (passedcriteria.sort) {
    if (passedcriteria.sort.length > 0) {
      sortClauseArray = passedcriteria.sort
        .map((c) => getSortClause(c))
        .filter((c) => !!c);
    }
  }

  function getSortClause(sortObj) {
    let str = '';
    if (_.isObject(sortObj)) {
      _.each(sortObj, (value, key) => {
        str += `record.${key} ${value}`;
      });
    }
    return str;
  }

  const letStatements = getLetStatements(passedcriteria.let || {});
  const compiledwhere = getAndStatement(passedcriteria.where || {});
  const compiledwherevertex = getAndStatement(passedcriteria.whereVertex || {});
  const compiledwhereedge = getAndStatement(passedcriteria.whereEdge || {});

  const obj = {
    ...passedcriteria,
    letStatements,
    method,
    select: hasSelectFields()
      ? selectAttributes(passedcriteria.select)
      : ['_key'],
    from: model,
    tableName: model,
    model,
    selectClause: hasSelectFields()
      ? selectAttributes(passedcriteria.select).join(', ')
      : '*',
    whereClause: compiledwhere,
    primarywhere,
    whereVertexClause: compiledwherevertex.replace('record.', 'vertex.'),
    whereEdgeClause: compiledwhereedge.replace('record.', 'edge.'),
    sortClauseArray,
    sortClause: sortClauseArray.join(', '),
    graphSort: sortClauseArray.join(', ').replace('record.', ''),
    numericAttrName: getNumericAttrName(),
    edgeCollections: getEdgeCollections(),
    geoAttrName: getGeoAttrName(),
    geoRadius: getGeoRadius(),
    distanceCriteria: getDistanceCriteria(),
    values: values || {},
  };

  if (method === 'upsert' || method === 'update') {
    obj.criteria = stringifyUpdateValues(
      {
        ...passedcriteria.where,
      },
      method
    );
    obj.insertvalues = stringifyUpdateValues(
      {
        ...passedcriteria.where,
        ...(values || {}),
        createdAt: new Date().getTime(),
      },
      method
    );

    obj.values = stringifyUpdateValues(values || {}, method);

    obj.valuesToSet = normalizeUpdateValues(values || {}, method);
  }

  if (method === 'create' || method === 'createEach') {
    obj.values = values || [];
  }

  if (method === 'aggregate') {
    const getAggregateStatement = require('./helpers/getAggregateStatement');
    return {
      aggregatestatement: getAggregateStatement({
        aggregateCriteria,
        pkColumnName,
        model,
      }),
    };
  }

  return obj;
};
