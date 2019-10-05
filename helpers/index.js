module.exports = {
  normalizeDatastoreConfig: require('./normalize-datastore-config'),
  registerDataStore: require('./register-data-store'),
  teardown: require('./teardown'),
  select: require('./find'),
  findNear: require('./find-near'),
  create: require('./create'),
  createEach: require('./create-each'),
  update: require('./update'),
  upsert: require('./upsert'),
  destroy: require('./destroy'),
  count: require('./count'),
  sum: require('./sum'),
  avg: require('./avg'),

  drop: require('./drop'),
  define: require('./define'),
  setSequence: require('./set-sequence'),

  // Graph Methods
  createEdge: require('./create-edge'),
  getOutboundVerices: require('./get-outbound-vertices'),
  getInboundVerices: require('./get-inbound-vertices'),
  aggregate: require('./aggregate'),
  normalize: require('./normalize'),
  normalizeEach: require('./normalize-each'),
};
