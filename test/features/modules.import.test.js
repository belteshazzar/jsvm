import { test, expect } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

test('imports: basic named import with requestImport hook', () => {
  const src = `
    import { greet } from 'greeting';
    print(greet);
  `;
  
  // Create a module mock
  const modules = {
    greeting: {
      greet: 'Hello from module!'
    }
  };
  
  const output = [];
  const result = runAndCapture(src, {
    requestImport: (modulePath, specs) => {
      const mod = modules[modulePath];
      if (!mod) throw new Error(`Module not found: ${modulePath}`);
      return mod;
    },
    onPrint: s => output.push(s)
  });
  
  expect(output).toEqual(['Hello from module!']);
});

test('imports: multiple specifiers from same module', () => {
  const src = `
    import { greet, farewell } from 'greeting';
    print(greet);
    print(farewell);
  `;
  
  const modules = {
    greeting: {
      greet: 'Hello',
      farewell: 'Goodbye'
    }
  };
  
  const output = [];
  runAndCapture(src, {
    requestImport: (modulePath, specs) => modules[modulePath],
    onPrint: s => output.push(s)
  });
  
  expect(output).toEqual(['Hello', 'Goodbye']);
});

test('imports: import caching - module loaded once', () => {
  const src = `
    import { value } from 'counter';
    print(value);
    import { value as v2 } from 'counter';
    print(v2);
  `;
  
  let loadCount = 0;
  const modules = {
    counter: { value: 42 }
  };
  
  const output = [];
  runAndCapture(src, {
    requestImport: (modulePath, specs) => {
      loadCount++;
      return modules[modulePath];
    },
    onPrint: s => output.push(s)
  });
  
  expect(output).toEqual(['42', '42']);
  // Module should only be loaded once due to caching
  expect(loadCount).toBe(1);
});

test('imports: boxed values from plain JS objects', () => {
  const src = `
    import { nums } from 'data';
    print(typeof nums);
  `;
  
  const modules = {
    data: {
      nums: [1, 2, 3]
    }
  };
  
  const output = [];
  runAndCapture(src, {
    requestImport: (modulePath, specs) => modules[modulePath],
    onPrint: s => output.push(s)
  });
  
  expect(output).toEqual(['arr']);
});

test('imports: missing export defaults to undefined', () => {
  const src = `
    import { notExist } from 'module';
    print(notExist === undefined);
  `;
  
  const modules = {
    module: { something: 'else' }
  };
  
  const output = [];
  runAndCapture(src, {
    requestImport: (modulePath, specs) => modules[modulePath],
    onPrint: s => output.push(s)
  });
  
  expect(output).toEqual(['true']);
});

test('imports: error when requestImport not provided', () => {
  const src = `
    import { greet } from 'greeting';
  `;
  
  // runAndCapture without requestImport should throw
  expect(() => {
    runAndCapture(src, {
      requestImport: undefined,
      onPrint: () => {}
    });
  }).toThrow('Import not supported in this VM');
});

test('imports: with boxed module object', () => {
  const src = `
    import { data } from 'store';
    print(data.name);
  `;
  
  const modules = {
    store: {
      data: {
        name: 'Alice',
        age: 30
      }
    }
  };
  
  const output = [];
  runAndCapture(src, {
    requestImport: (modulePath, specs) => modules[modulePath],
    onPrint: s => output.push(s)
  });
  
  expect(output).toEqual(['Alice']);
});
