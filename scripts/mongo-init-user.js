// Runs once, on an empty data directory, as part of the mongo image's init.
// Creates a least-privilege user for the application: read and write on its own
// database, and nothing anywhere else.
const database = process.env.MONGO_INITDB_DATABASE || 'portfolio';

db.getSiblingDB(database).createUser({
  user: process.env.MONGO_APP_USERNAME,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: database }],
});
