const c = require('./lib/cdr-repo');
c.listCdr('1', { limit: 8 })
  .then((rows) => {
    for (const x of rows) {
      console.log(`${x.startedAt} rec=${x.recordingId ?? 'none'} session=${x.callSessionId.slice(0, 8)}`);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
