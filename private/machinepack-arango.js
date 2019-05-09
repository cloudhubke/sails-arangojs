const { Database, aql } = require('arangojs');
const Machine = require('machine');
const _ = require('@sailshq/lodash');
/**
 * Module constants
 */

// Private var to cache dry machine definitions.
// > This is set up in a dictionary instead of as separate variables
// > just to allow the code below to be a bit easier to read)
const DRY_MACHINES = {
  createManager: require('./machines/create-manager'),
  destroyManager: require('./machines/destroy-manager'),
  getConnection: require('./machines/get-connection'),
  releaseConnection: require('./machines/release-connection'),
};

// Private var to cache pre-built machines for certain adapter methods.
// (This is an optimization for improved performance.)
const WET_MACHINES = {};
_.each(DRY_MACHINES, (def, methodName) => {
  WET_MACHINES[methodName] = Machine.build(def);
});

const driver = {
  createManager: WET_MACHINES.createManager,
  destroyManager: WET_MACHINES.destroyManager,
  getConnection: WET_MACHINES.getConnection,
  releaseConnection: WET_MACHINES.releaseConnection,
  Database,
  aql,
};

module.exports = driver;
