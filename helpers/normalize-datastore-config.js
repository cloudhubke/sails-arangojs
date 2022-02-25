// This is a function to normalize the Datasource config

const normalizeConfig = require('../private/normalize-datastore-config');

const CONFIG_WHITELIST = require('../private/constants/config-whitelist.constant');
const EXPECTED_URL_PROTOCOL_PFX = require('../private/constants/expected-url-protocol-pfx.constant');

module.exports = require('machine').build({
  friendlyName: 'Normaliza Datastore Config',

  description: 'Get a config object from the given URL/Connection Strine',

  sync: false,

  inputs: {
    config: {
      description: 'The configuration to use for the data store.',
      required: true,
      example: '===',
    },
  },

  exits: {
    success: {
      description: 'The object was generated successfully.',
    },
    badConfiguration: {
      description: 'The configuration was invalid.',
      outputType: 'ref',
    },
    error: {
      description: 'An error registering data storer',
      outputType: 'ref',
    },
  },

  fn: async function normalizeDatastoreConfig({ config }, exits) {
    const datastoreConfig = config;
    try {
      normalizeConfig(
        datastoreConfig,
        CONFIG_WHITELIST,
        EXPECTED_URL_PROTOCOL_PFX
      );
    } catch (e) {
      console.log(e, config);
      switch (e.code) {
        case 'E_BAD_CONFIG':
          return exits.badConfiguration(e);
        default:
          return exits.error(e);
      }
    }

    return exits.success({ ...datastoreConfig });
  },
});
