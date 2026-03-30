console.error(
  'This legacy backend entrypoint is no longer used.\n' +
  'Start the active backend with "node server.js" inside backend or "npm start" from the project root.\n' +
  'The supported local API port is 5000.'
);

process.exit(1);
