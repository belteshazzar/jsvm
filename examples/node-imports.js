#!/usr/bin/env node

/**
 * Example: Node.js Integration with jsvm Imports
 * 
 * This example demonstrates using the Node.js platform adapter
 * to load modules in a jsvm program.
 */

import { run } from '../main.js';
import { createNodeImportResolver } from '../src/platform/node.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Example jsvm program using imports
const program = `
import { add, multiply } from 'math-utils';
import { apiUrl, timeout } from 'config';

print('Using math utilities:');
print(add(5, 3));
print(multiply(4, 2));

print('Configuration:');
print('API URL: ' + apiUrl);
print('Timeout: ' + timeout);
`;

async function main() {
  try {
    // Create a resolver pointing to the example modules directory
    const resolver = createNodeImportResolver({
      basePath: path.join(__dirname, 'modules'),
      cache: true
    });

    console.log('Running jsvm program with imports...\n');

    // Run the program with the resolver
    run(program, {
      requestImport: resolver.requestImport
    });

    console.log('\nModule cache:', resolver.moduleCache);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
