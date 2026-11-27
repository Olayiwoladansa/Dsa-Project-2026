import { pathToFileURL } from 'node:url';
import { createAppServer } from './http/app.js';
import { openDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';
import { PORT } from './config.js';

export function startServer(port = PORT) {
  const database = openDatabase();
  const repository = createSqliteRepository(database);

  const server = createAppServer({ repository });

  server.on('close', () => {
    database.close();
  });

  server.listen(port, () => {
    console.log(`Event ticketing server listening on port ${port}`);
    console.log('Database: SQLite (persistent storage)');
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
