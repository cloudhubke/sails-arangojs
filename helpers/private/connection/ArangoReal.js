'use strict';

const EventEmitter = require('events');

const dbEvents = {
  2300: 'onCreateOrUpdate',
  2302: 'onDelete',
};

class ArangoReal extends EventEmitter {
  constructor(opts) {
    super();
    this.db = opts.db;
    this._loggerStatePath = `/_api/wal/lastTick`;
    this._loggerFollowPath = `/_api/wal/tail`;
    this._stopped = false;
    this.collections = opts.collections || [];
  }

  start() {
    this._stopped = false;
    this._startLoggerState();
  }

  stop() {
    this._stopped = true;
  }

  _startLoggerState() {
    this.db.request(
      { path: this._loggerStatePath, method: 'get' },
      ({ statusCode: status, headers, body }) => {
        if (200 !== status) {
          this.emit('error', new Error('E_LOGGERSTATE'), status, headers, body);
          this.stop();
          return;
        }
        let lastLogTick = body.tick;
        let type;
        let tid;
        let entry;

        const txns = new Map();

        const handleEntry = () => {
          const { data } = entry;

          if (!data._id) return;

          const collectionName = `${data._id}`.split('/')[0];

          const event = dbEvents[type];

          if (!event) return;

          this.emit(collectionName, data, event);
        };

        const ticktock = async () => {
          if (this._stopped) return;
          try {
            const {
              statusCode: status,
              headers,
              body,
            } = await this.db.request({
              path: `${this._loggerFollowPath}?from=${lastLogTick}`,
              method: 'get',
            });

            if (204 < status || 0 === status) {
              // this.emit(
              //   'error',
              //   new Error('E_LOGGERFOLLOW'),
              //   status,
              //   headers,
              //   body
              // );
              // this.stop();
              return setTimeout(ticktock, 1000);
            } // if

            if ('0' === headers['x-arango-replication-lastincluded']) {
              return setTimeout(ticktock, 500);
            } // if

            lastLogTick = headers['x-arango-replication-lastincluded'];
            const entries = body.toString().trim().split('\n');

            for (const i in entries) {
              entry = JSON.parse(entries[i]);

              // transaction   {"tick":"514132959101","type":2200,"tid":"514132959099","database":"1"}
              // insert/update {"tick":"514092205556","type":2300,"tid":"0","database":"1","cid":"513417247371","cname":"test","data":{"_id":"test/testkey","_key":"testkey","_rev":"514092205554",...}}
              // delete        {"tick":"514092206277","type":2302,"tid":"0","database":"1","cid":"513417247371","cname":"test","data":{"_key":"abcdef","_rev":"514092206275"}}

              //2300  = Insert/Update
              //2200 = Start transaction
              //2201 = commit
              //2202 = Abort
              //2302 = Remove
              //tid="0" indicates its a single operation not part of a 'transaction'

              type = entry.type;
              tid = entry.tid;

              if (2200 === type) {
                // txn start
                txns.set(tid, new Set());
              } else if (2201 === type) {
                // txn commit and replay docs
                for (const data of txns.get(tid)) {
                  [type, entry] = data;
                  handleEntry();
                } // for
                txns.delete(tid);
              } else if (2002 === type) {
                // txn abort
                txns.delete(tid);
              } else {
                if (2300 !== type && 2302 !== type) continue;

                if ('0' !== tid) {
                  txns.get(tid).add([type, entry]);
                  continue;
                }

                handleEntry();
              }
            }
            ticktock();
          } catch (error) {
            console.log('DB ERROR', error.toString());
            return setTimeout(ticktock, 1000);
          }
        };
        ticktock();
      }
    );
  }
}

module.exports = ArangoReal;
