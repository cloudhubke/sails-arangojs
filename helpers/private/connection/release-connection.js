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

const ArangoDb = require('../../../private/machinepack-arango');

module.exports = async function releaseConnection(connection) {
  return ArangoDb.releaseConnection({
    connection,
  }).switch({
    error: function error(err) {
      return new Error(
        `There was an error releasing the connection back into the pool.${
          err.stack
        }`,
      );
    },
    badConnection: function badConnection() {
      return new Error(
        'Bad connection when trying to release an active connection.',
      );
    },
    success: function success() {
      return null;
    },
  });
};
