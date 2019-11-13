/**
 * Module dependencies
 */

const _ = require('@sailshq/lodash');
const flaverr = require('flaverr');
const ArangoDB = require('./private/machinepack-arango');
const Helpers = require('./helpers');

/**
 * Module state
 */

// Private var to track of all the datastores that use this adapter.  In order for your adapter
// to be able to connect to the database, you'll want to expose this var publicly as well.
// (See the `registerDatastore()` method for info on the format of each datastore entry herein.)
//
// > Note that this approach of process global state will be changing in an upcoming version of
// > the Waterline adapter spec (a breaking change).  But if you follow the conventions laid out
// > below in this adapter template, future upgrades should be a breeze.
const registeredDatastores = {};

// Keep track of all the model definitions registered by the adapter (for the entire Node process).
// (indexed by the model's `identity` -- NOT by its `tableName`!!)

const registeredModels = {};

/**
 * @bernardgaitho/sails-arangojs
 *
 * Expose the adapater definition.
 *
 * > Most of the methods below are optional.
 * >
 * > If you don't need / can't get to every method, just implement
 * > what you have time for.  The other methods will only fail if
 * > you try to call them!
 * >
 * > For many adapters, this file is all you need.  For very complex adapters, you may need more flexiblity.
 * > In any case, it's probably a good idea to start with one file and refactor only if necessary.
 * > If you do go that route, it's conventional in Node to create a `./lib` directory for your private submodules
 * > and `require` them at the top of this file with other dependencies. e.g.:
 * > ```
 * > var updateMethod = require('./lib/update');
 * > ```
 *
 * @type {Dictionary}
 */
module.exports = {
  // The identity of this adapter, to be referenced by datastore configurations in a Sails app.
  identity: 'sails-arangojs',

  // Waterline Adapter API Version
  //
  // > Note that this is not necessarily tied to the major version release cycle of Sails/Waterline!
  // > For example, Sails v1.5.0 might generate apps which use sails-hook-orm@2.3.0, which might
  // > include Waterline v0.13.4.  And all those things might rely on version 1 of the adapter API.
  // > But Waterline v0.13.5 might support version 2 of the adapter API!!  And while you can generally
  // > trust semantic versioning to predict/understand userland API changes, be aware that the maximum
  // > and/or minimum _adapter API version_ supported by Waterline could be incremented between major
  // > version releases.  When possible, compatibility for past versions of the adapter spec will be
  // > maintained; just bear in mind that this is a _separate_ number, different from the NPM package
  // > version.  sails-hook-orm verifies this adapter API version when loading adapters to ensure
  // > compatibility, so you should be able to rely on it to provide a good error message to the Sails
  // > applications which use this adapter.
  adapterApiVersion: 1,

  // Default datastore configuration.
  defaults: {
    // foo: 'bar',
  },

  //  ╔═╗═╗ ╦╔═╗╔═╗╔═╗╔═╗  ┌─┐┬─┐┬┬  ┬┌─┐┌┬┐┌─┐
  //  ║╣ ╔╩╦╝╠═╝║ ║╚═╗║╣   ├─┘├┬┘│└┐┌┘├─┤ │ ├┤
  //  ╚═╝╩ ╚═╩  ╚═╝╚═╝╚═╝  ┴  ┴└─┴ └┘ ┴ ┴ ┴ └─┘
  //  ┌┬┐┌─┐┌┬┐┌─┐┌─┐┌┬┐┌─┐┬─┐┌─┐┌─┐
  //   ││├─┤ │ ├─┤└─┐ │ │ │├┬┘├┤ └─┐
  //  ─┴┘┴ ┴ ┴ ┴ ┴└─┘ ┴ └─┘┴└─└─┘└─┘
  // This allows outside access to this adapter's internal registry of datastore entries,
  // for use in datastore methods like `.leaseConnection()`.
  datastores: registeredDatastores,

  registeredModels,

  // ////////////////////////////////////////////////////////////////////////////////////////////////
  //  ██╗     ██╗███████╗███████╗ ██████╗██╗   ██╗ ██████╗██╗     ███████╗                        //
  //  ██║     ██║██╔════╝██╔════╝██╔════╝╚██╗ ██╔╝██╔════╝██║     ██╔════╝                        //
  //  ██║     ██║█████╗  █████╗  ██║      ╚████╔╝ ██║     ██║     █████╗                          //
  //  ██║     ██║██╔══╝  ██╔══╝  ██║       ╚██╔╝  ██║     ██║     ██╔══╝                          //
  //  ███████╗██║██║     ███████╗╚██████╗   ██║   ╚██████╗███████╗███████╗                        //
  //  ╚══════╝╚═╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝    ╚═════╝╚══════╝╚══════╝                        //
  //                                                                                              //
  // Lifecycle adapter methods:                                                                   //
  // Methods related to setting up and tearing down; registering/un-registering datastores.       //
  // ////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   *  ╦═╗╔═╗╔═╗╦╔═╗╔╦╗╔═╗╦═╗  ┌┬┐┌─┐┌┬┐┌─┐┌─┐┌┬┐┌─┐┬─┐┌─┐
   *  ╠╦╝║╣ ║ ╦║╚═╗ ║ ║╣ ╠╦╝   ││├─┤ │ ├─┤└─┐ │ │ │├┬┘├┤
   *  ╩╚═╚═╝╚═╝╩╚═╝ ╩ ╚═╝╩╚═  ─┴┘┴ ┴ ┴ ┴ ┴└─┘ ┴ └─┘┴└─└─┘
   * Register a new datastore with this adapter.  This usually involves creating a new
   * connection manager (e.g. MySQL pool or MongoDB client) for the underlying database layer.
   *
   * > Waterline calls this method once for every datastore that is configured to use this adapter.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Dictionary}   datastoreConfig            Dictionary (plain JavaScript object) of configuration options for this datastore (e.g. host, port, etc.)
   * @param  {Dictionary}   physicalModelsReport       Experimental: The physical models using this datastore (keyed by "tableName"-- NOT by `identity`!).  This may change in a future release of the adapter spec.
   *         @property {Dictionary} *  [Info about a physical model using this datastore.  WARNING: This is in a bit of an unusual format.]
   *                   @property {String} primaryKey        [the name of the primary key attribute (NOT the column name-- the attribute name!)]
   *                   @property {Dictionary} definition    [the physical-layer report from waterline-schema.  NOTE THAT THIS IS NOT A NORMAL MODEL DEF!]
   *                   @property {String} tableName         [the model's `tableName` (same as the key this is under, just here for convenience)]
   *                   @property {String} identity          [the model's `identity`]
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done                       A callback to trigger after successfully registering this datastore, or if an error is encountered.
   *               @param {Error?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  async registerDatastore(datastoreConfig, models, done) {
    // Grab the unique name for this datastore for easy access below.
    const datastoreName = datastoreConfig.identity;

    // Some sanity checks:
    if (!datastoreName) {
      return done(
        new Error(
          'Consistency violation: A datastore should contain an "identity" property: a special identifier that uniquely identifies it across this app.  This should have been provided by Waterline core!  If you are seeing this message, there could be a bug in Waterline, or the datastore could have become corrupted by userland code, or other code in this adapter.  If you determine that this is a Waterline bug, please report this at https://sailsjs.com/bugs.'
        )
      );
    }
    if (registeredDatastores[datastoreName]) {
      return done(
        new Error(
          `Consistency violation: Cannot register datastore: \`${datastoreName}\`, because it is already registered with this adapter!  This could be due to an unexpected race condition in userland code (e.g. attempting to initialize Waterline more than once), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    //  ╔═╗╔═╗╦═╗╔╦╗╦╔═╗╦ ╦  ┌─┐┌─┐┌─┐┬┌┐┌┌─┐┌┬┐  ┌┬┐┌┐    ┌─┐┌─┐┌─┐┌─┐┬┌─┐┬┌─┐
    //  ║  ║╣ ╠╦╝ ║ ║╠╣ ╚╦╝  ├─┤│ ┬├─┤││││└─┐ │    ││├┴┐───└─┐├─┘├┤ │  │├┤ ││
    //  ╚═╝╚═╝╩╚═ ╩ ╩╚   ╩   ┴ ┴└─┘┴ ┴┴┘└┘└─┘ ┴   ─┴┘└─┘   └─┘┴  └─┘└─┘┴└  ┴└─┘┘
    //  ┌─┐┌┐┌┌┬┐┌─┐┬  ┌─┐┌─┐┬┌─┐┌─┐┬    ┬─┐┌─┐┌─┐┌┬┐┬─┐┬┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
    //  │ ││││ │ │ ││  │ ││ ┬││  ├─┤│    ├┬┘├┤ └─┐ │ ├┬┘││   │ ││ ││││└─┐
    //  └─┘┘└┘ ┴ └─┘┴─┘└─┘└─┘┴└─┘┴ ┴┴─┘  ┴└─└─┘└─┘ ┴ ┴└─┴└─┘ ┴ ┴└─┘┘└┘└─┘

    // Validate models vs. adapter-specific restrictions (if relevant):
    // ============================================================================================
    if (ArangoDB.verifyModelDef) {
      const modelIncompatibilitiesMap = {};
      try {
        _.each(models, phModelInfo => {
          try {
            ArangoDB.verifyModelDef({ modelDef: phModelInfo }).execSync();
          } catch (e) {
            switch (e.exit) {
              case 'invalid':
                modelIncompatibilitiesMap[phModelInfo.identity] = e;
                break;
              default:
                throw e;
            }
          }
        }); // </_.each()>
      } catch (e) {
        return done(e);
      }

      const numNotCompatible = _.keys(modelIncompatibilitiesMap).length;
      if (numNotCompatible > 0) {
        return done(
          flaverr(
            'E_MODELS_NOT_COMPATIBLE',
            new Error(
              `${numNotCompatible} model(s) are not compatible with this adapter:\n${_.reduce(
                modelIncompatibilitiesMap,
                (memo, incompatibility, modelIdentity) => `${memo}• \`${modelIdentity}\`  :: ${incompatibility}\n`,
                ''
              )}`
            )
          )
        );
      } // -•
    } // >-•   </verify model definitions, if relevant>

    // Register the Datastore

    // console.log('HELPERS', Helpers.normalizeDatastoreConfig);

    await Helpers.normalizeDatastoreConfig({ config: datastoreConfig });

    return Helpers.registerDataStore({
      datastores: registeredDatastores,
      identity: datastoreConfig.identity,
      config: datastoreConfig,
      models,
      modelDefinitions: registeredModels,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      badConfiguration: function error(err) {
        return done(err);
      },
      success: function success() {
        return done();
      },
    });
  },

  /**
   *  ╔╦╗╔═╗╔═╗╦═╗╔╦╗╔═╗╦ ╦╔╗╔
   *   ║ ║╣ ╠═╣╠╦╝ ║║║ ║║║║║║║
   *   ╩ ╚═╝╩ ╩╩╚══╩╝╚═╝╚╩╝╝╚╝
   * Tear down (un-register) a datastore.
   *
   * Fired when a datastore is unregistered.  Typically called once for
   * each relevant datastore when the server is killed, or when Waterline
   * is shut down after a series of tests.  Useful for destroying the manager
   * (i.e. terminating any remaining open connections, etc.).
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String} datastoreName   The unique name (identity) of the datastore to un-register.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function} done          Callback
   *               @param {Error?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  teardown(datastoreName, done) {
    // Look up the datastore entry (manager/driver/config).
    const dsEntry = registeredDatastores[datastoreName];
    // Sanity checks:
    if (!datastoreName) {
      return done(
        new Error(
          `Consistency violation: Internal error in Waterline: Adapter received unexpected falsey datastore name (\`${datastoreName}\`)!  Can't look up a DS entry from this adapter with that...  (Please report this error at http://sailsjs.com/bugs.)`
        )
      );
    }
    if (_.isUndefined(dsEntry)) {
      return done(
        new Error(
          `Consistency violation: Attempting to tear down a datastore (\`${datastoreName}\`) which is not currently registered with this adapter.  This is usually due to a race condition in userland code (e.g. attempting to tear down the same ORM instance more than once), or it could be due to a bug in this adapter.  (If you get stumped, reach out at http://sailsjs.com/support.)`
        )
      );
    }
    if (!dsEntry.manager) {
      return done(
        new Error(
          'Consistency violation: Missing manager for this datastore. (This datastore may already be in the process of being destroyed.)'
        )
      );
    }

    return Helpers.teardown({
      identity: datastoreName,
      datastores: registeredDatastores,
      modelDefinitions: registeredModels,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success() {
        return done();
      },
    });
  },

  // ////////////////////////////////////////////////////////////////////////////////////////////////
  //  ██████╗ ███╗   ███╗██╗                                                                      //
  //  ██╔══██╗████╗ ████║██║                                                                      //
  //  ██║  ██║██╔████╔██║██║                                                                      //
  //  ██║  ██║██║╚██╔╝██║██║                                                                      //
  //  ██████╔╝██║ ╚═╝ ██║███████╗                                                                 //
  //  ╚═════╝ ╚═╝     ╚═╝╚══════╝                                                                 //
  // (D)ata (M)anipulation (L)anguage                                                             //
  //                                                                                              //
  // DML adapter methods:                                                                         //
  // Methods related to manipulating records stored in the database.                              //
  // ////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   *  ╔═╗╦═╗╔═╗╔═╗╔╦╗╔═╗
   *  ║  ╠╦╝║╣ ╠═╣ ║ ║╣
   *  ╚═╝╩╚═╚═╝╩ ╩ ╩ ╚═╝
   * Create a new record.
   *
   * (e.g. add a new row to a SQL table, or a new document to a MongoDB collection.)
   *
   * > Note that depending on the value of `query.meta.fetch`,
   * > you may be expected to return the physical record that was
   * > created (a dictionary) as the second argument to the callback.
   * > (Otherwise, exclude the 2nd argument or send back `undefined`.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done          Callback
   *               @param {Error?}
   *               @param {Dictionary?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  create(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const dsEntry = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(dsEntry)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    return Helpers.create({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      notUnique: function error(err) {
        return done(flaverr('E_UNIQUE', err));
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.record);
        }
        return done(undefined);
      },
    });
  },

  /**
   *  ╔═╗╦═╗╔═╗╔═╗╔╦╗╔═╗  ╔═╗╔═╗╔═╗╦ ╦
   *  ║  ╠╦╝║╣ ╠═╣ ║ ║╣   ║╣ ╠═╣║  ╠═╣
   *  ╚═╝╩╚═╚═╝╩ ╩ ╩ ╚═╝  ╚═╝╩ ╩╚═╝╩ ╩
   * Create multiple new records.
   *
   * > Note that depending on the value of `query.meta.fetch`,
   * > you may be expected to return the array of physical records
   * > that were created as the second argument to the callback.
   * > (Otherwise, exclude the 2nd argument or send back `undefined`.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done            Callback
   *               @param {Error?}
   *               @param {Array?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  createEach(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    const models = registeredModels[datastoreName];

    return Helpers.createEach({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      notUnique: function error(errInfo) {
        const e = new Error(errInfo.message);
        e.footprint = errInfo.footprint;
        return done(e);
      },
      success: function success(report) {
        const records = (report && report.records) || undefined;
        return done(undefined, records);
      },
    });
  },

  /**
   *  ╦ ╦╔═╗╔╦╗╔═╗╔╦╗╔═╗
   *  ║ ║╠═╝ ║║╠═╣ ║ ║╣
   *  ╚═╝╩  ═╩╝╩ ╩ ╩ ╚═╝
   * Update matching records.
   *
   * > Note that depending on the value of `query.meta.fetch`,
   * > you may be expected to return the array of physical records
   * > that were updated as the second argument to the callback.
   * > (Otherwise, exclude the 2nd argument or send back `undefined`.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done            Callback
   *               @param {Error?}
   *               @param {Array?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  update(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }
    const models = registeredModels[datastoreName];

    return Helpers.update({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      notUnique: function error(errInfo) {
        return done(flaverr('E_UNIQUE', errInfo));
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.records);
        }
        return done();
      },
    });
  },

  /**

   * upsert matching records.
   *
   * > Note that depending on the value of `query.meta.fetch`,
   * > you may be expected to return the array of physical records
   * > that were upsertd as the second argument to the callback.
   * > (Otherwise, exclude the 2nd argument or send back `undefined`.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done            Callback
   *               @param {Error?}
   *               @param {Array?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  upsert(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }
    const models = registeredModels[datastoreName];

    return Helpers.upsert({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      notUnique: function error(errInfo) {
        return done(flaverr('E_UNIQUE', errInfo));
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.records);
        }
        return done();
      },
    });
  },

  /**
   *  ╔╦╗╔═╗╔═╗╔╦╗╦═╗╔═╗╦ ╦
   *   ║║║╣ ╚═╗ ║ ╠╦╝║ ║╚╦╝
   *  ═╩╝╚═╝╚═╝ ╩ ╩╚═╚═╝ ╩
   * Destroy one or more records.
   *
   * > Note that depending on the value of `query.meta.fetch`,
   * > you may be expected to return the array of physical records
   * > that were destroyed as the second argument to the callback.
   * > (Otherwise, exclude the 2nd argument or send back `undefined`.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done            Callback
   *               @param {Error?}
   *               @param {Array?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  destroy(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.destroy({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.records);
        }
        return done(undefined);
      },
    });
  },

  // ////////////////////////////////////////////////////////////////////////////////////////////////
  //  ██████╗  ██████╗ ██╗                                                                        //
  //  ██╔══██╗██╔═══██╗██║                                                                        //
  //  ██║  ██║██║   ██║██║                                                                        //
  //  ██║  ██║██║▄▄ ██║██║                                                                        //
  //  ██████╔╝╚██████╔╝███████╗                                                                   //
  //  ╚═════╝  ╚══▀▀═╝ ╚══════╝                                                                   //
  // (D)ata (Q)uery (L)anguage                                                                    //
  //                                                                                              //
  // DQL adapter methods:                                                                         //
  // Methods related to fetching information from the database (e.g. finding stored records).     //
  // ////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   *  ╔═╗╦╔╗╔╔╦╗
   *  ╠╣ ║║║║ ║║
   *  ╚  ╩╝╚╝═╩╝
   * Find matching records.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done            Callback
   *               @param {Error?}
   *               @param {Array}  [matching physical records]
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  find(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.select({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report.records);
      },
    });
  },

  sample(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.sample({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report.records);
      },
    });
  },

  findNear(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.findNear({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report.records);
      },
    });
  },

  /**
   *  ╔═╗╔═╗╦ ╦╔╗╔╔╦╗
   *  ║  ║ ║║ ║║║║ ║
   *  ╚═╝╚═╝╚═╝╝╚╝ ╩
   * Get the number of matching records.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done          Callback
   *               @param {Error?}
   *               @param {Number}  [the number of matching records]
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  count(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.count({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report);
      },
    });
  },

  /**
   *  ╔═╗╦ ╦╔╦╗
   *  ╚═╗║ ║║║║
   *  ╚═╝╚═╝╩ ╩
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done          Callback
   *               @param {Error?}
   *               @param {Number}  [the sum]
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  sum(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.sum({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report);
      },
    });
  },

  /**
   *  ╔═╗╦  ╦╔═╗
   *  ╠═╣╚╗╔╝║ ╦
   *  ╩ ╩ ╚╝ ╚═╝
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore to perform the query on.
   * @param  {Dictionary}   query         The stage-3 query to perform.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done          Callback
   *               @param {Error?}
   *               @param {Number}  [the average ("mean")]
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  avg(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];
    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.avg({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report);
      },
    });
  },

  // ////////////////////////////////////////////////////////////////////////////////////////////////
  //  ██████╗ ██████╗ ██╗                                                                         //
  //  ██╔══██╗██╔══██╗██║                                                                         //
  //  ██║  ██║██║  ██║██║                                                                         //
  //  ██║  ██║██║  ██║██║                                                                         //
  //  ██████╔╝██████╔╝███████╗                                                                    //
  //  ╚═════╝ ╚═════╝ ╚══════╝                                                                    //
  // (D)ata (D)efinition (L)anguage                                                               //
  //                                                                                              //
  // DDL adapter methods:                                                                         //
  // Methods related to modifying the underlying structure of physical models in the database.    //
  // ////////////////////////////////////////////////////////////////////////////////////////////////

  //  ██████╗ ██████╗ ██╗
  //  ██╔══██╗██╔══██╗██║
  //  ██║  ██║██║  ██║██║
  //  ██║  ██║██║  ██║██║
  //  ██████╔╝██████╔╝███████╗
  //  ╚═════╝ ╚═════╝ ╚══════╝
  //
  // Methods related to modifying the underlying data structure of the
  // database.

  /**
   *  ╔╦╗╔═╗╔═╗╦╔╗╔╔═╗
   *   ║║║╣ ╠╣ ║║║║║╣
   *  ═╩╝╚═╝╚  ╩╝╚╝╚═╝
   * Build a new physical model (e.g. table/etc) to use for storing records in the database.
   *
   * (This is used for schema migrations.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore containing the table to define.
   * @param  {String}       tableName     The name of the table to define.
   * @param  {Dictionary}   definition    The physical model definition (not a normal Sails/Waterline model-- log this for details.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done           Callback
   *               @param {Error?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  define(datastoreName, tableName, definition, done, meta) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];

    const models = registeredModels[datastoreName];
    const model = models[tableName];

    // Sanity check:
    if (_.isUndefined(model)) {
      return done(
        new Error(
          `The model with tableName (\`${tableName}\`) has not been defined. Could not get the classType for the model associated with ${tableName})`
        )
      );
    }

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.define({
      datastore,
      tableName,
      definition,
      model,
      meta,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success() {
        return done();
      },
    });
  },

  /**
   *  ╔╦╗╦═╗╔═╗╔═╗
   *   ║║╠╦╝║ ║╠═╝
   *  ═╩╝╩╚═╚═╝╩
   * Drop a physical model (table/etc.) from the database, including all of its records.
   *
   * (This is used for schema migrations.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName The name of the datastore containing the table to drop.
   * @param  {String}       tableName     The name of the table to drop.
   * @param  {Ref}          unused        Currently unused (do not use this argument.)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done          Callback
   *               @param {Error?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  drop(datastoreName, tableName, unused, done, meta) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.drop({
      datastore,
      meta,
      tableName,
      models,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      badConnection: function badConnection(err) {
        return done(err);
      },
      success: function success() {
        return done();
      },
    });
  },

  /**
   *  ╔═╗╔═╗╔╦╗  ┌─┐┌─┐┌─┐ ┬ ┬┌─┐┌┐┌┌─┐┌─┐
   *  ╚═╗║╣  ║   └─┐├┤ │─┼┐│ │├┤ ││││  ├┤
   *  ╚═╝╚═╝ ╩   └─┘└─┘└─┘└└─┘└─┘┘└┘└─┘└─┘
   * Set a sequence in a physical model (specifically, the auto-incrementing
   * counter for the primary key) to the specified value.
   *
   * (This is used for schema migrations.)
   *
   * > NOTE - If your adapter doesn't support sequence entities (like PostgreSQL),
   * > you should remove this method.
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {String}       datastoreName   The name of the datastore containing the table/etc.
   * @param  {String}       sequenceName    The name of the sequence to update.
   * @param  {Number}       sequenceValue   The new value for the sequence (e.g. 1)
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   * @param  {Function}     done
   *               @param {Error?}
   * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   */
  setSequence(datastoreName, sequenceName, sequenceValue, done, meta) {
    // Look up the datastore entry (manager/driver/config).
    const datastore = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }
    return Helpers.setSequence({
      datastore,
      sequenceName,
      sequenceValue,
      meta,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success() {
        return done();
      },
    });
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // CREATE EDGE
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  createEdge(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastore}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.createEdge({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      invalidVertex: function error(err) {
        return done(err);
      },
      notUnique: function error(err) {
        return done(flaverr('E_UNIQUE', err));
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.record);
        }
        return done(undefined);
      },
    });
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // getInboundVertices
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getInboundVertices(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastore}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.getInboundVerices({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report.record);
      },
    });
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // getOutboundVertices
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  getOutboundVertices(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastore}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.getOutboundVerices({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report.record);
      },
    });
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Aggregate
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  aggregate(datastoreName, query, done) {
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    // Sanity check:
    if (_.isUndefined(datastore)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastore}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }

    return Helpers.aggregate({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      success: function success(report) {
        return done(undefined, report.records);
      },
    });
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // normalize
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  normalize(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const dsEntry = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(dsEntry)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    return Helpers.normalize({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      notUnique: function error(err) {
        return done(flaverr('E_UNIQUE', err));
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.record);
        }
        return done(undefined);
      },
    });
  },

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // normalize
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  normalizeEach(datastoreName, query, done) {
    // Look up the datastore entry (manager/driver/config).
    const dsEntry = registeredDatastores[datastoreName];

    // Sanity check:
    if (_.isUndefined(dsEntry)) {
      return done(
        new Error(
          `Consistency violation: Cannot do that with datastore (\`${datastoreName}\`) because no matching datastore entry is registered in this adapter!  This is usually due to a race condition (e.g. a lifecycle callback still running after the ORM has been torn down), or it could be due to a bug in this adapter.  (If you get stumped, reach out at https://sailsjs.com/support.)`
        )
      );
    }
    const datastore = registeredDatastores[datastoreName];
    const models = registeredModels[datastoreName];

    return Helpers.normalizeEach({
      datastore,
      models,
      query,
    }).switch({
      error: function error(err) {
        return done(err);
      },
      notUnique: function error(err) {
        return done(flaverr('E_UNIQUE', err));
      },
      success: function success(report) {
        if (report) {
          return done(undefined, report.records);
        }
        return done(undefined);
      },
    });
  },
};
