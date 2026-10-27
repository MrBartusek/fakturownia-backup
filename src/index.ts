console.log('fakturownia-backup started');

// Keeps the process alive until the scheduler exists.
const keepAlive = setInterval(() => {}, 2 ** 30);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down`);
    clearInterval(keepAlive);
  });
}
