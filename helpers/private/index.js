module.exports = {
  // Helpers for handling connections
  connection: {
    spawnConnection: require('./connection/spawn-connection'),
    spawnOrLeaseConnection: require('./connection/spawn-or-lease-connection'),
    releaseSession: require('./connection/release-session'),
  },
  query: {
    preProcessRecord: require('./query/pre-process-record'),
    processNativeRecord: require('./query/process-native-record'),
    capitalize: require('./query/capitalize'),
    converter: require('./query/converter'),
    compileStatement: require('./query/compile-statement'),
  },

  // Helpers for dealing with underlying database schema
  schema: {
    buildSchema: require('./schema/build-schema'),
    escapeTableName: require('./schema/escape-table-name'),
  },
};
