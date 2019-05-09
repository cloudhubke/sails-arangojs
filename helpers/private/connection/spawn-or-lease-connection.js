//  ███████╗██████╗  █████╗ ██╗    ██╗███╗   ██╗     ██████╗ ██████╗     ██╗     ███████╗ █████╗ ███████╗███████╗
//  ██╔════╝██╔══██╗██╔══██╗██║    ██║████╗  ██║    ██╔═══██╗██╔══██╗    ██║     ██╔════╝██╔══██╗██╔════╝██╔════╝
//  ███████╗██████╔╝███████║██║ █╗ ██║██╔██╗ ██║    ██║   ██║██████╔╝    ██║     █████╗  ███████║███████╗█████╗
//  ╚════██║██╔═══╝ ██╔══██║██║███╗██║██║╚██╗██║    ██║   ██║██╔══██╗    ██║     ██╔══╝  ██╔══██║╚════██║██╔══╝
//  ███████║██║     ██║  ██║╚███╔███╔╝██║ ╚████║    ╚██████╔╝██║  ██║    ███████╗███████╗██║  ██║███████║███████╗
//  ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═══╝     ╚═════╝ ╚═╝  ╚═╝    ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
//
// Returns either the leased connection that was passed in to the meta input of
// a helper or spawns a new connection. This is a normalized helper so the actual
// helper methods don't need to deal with the branching logic.

const _ = require('@sailshq/lodash');
const spawnConnection = require('./spawn-connection');

module.exports = function spawnOrLeaseConnection(datastore, meta) {
  if (!_.isUndefined(meta) && _.has(meta, 'leasedConnection')) {
    return setImmediate(() => meta.leasedConnection);
  }

  return spawnConnection(datastore);
  // Otherwise spawn the connection
};
