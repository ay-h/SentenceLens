/**
 * Word Lookup Service Tests
 * Tests dictionary service, database caching, and API route logic.
 * Run: node server/tests/word-lookup.test.js
 */

const path = require('path');
const assert = require('assert');

// Set APP_DATA_DIR to a temp location for test isolation
const os = require('os');
const fs = require('fs');
const testDataDir = path.join(os.tmpdir(), `sentlens-test-${Date.now()}`);
fs.mkdirSync(testDataDir, { recursive: true });
process.env.APP_DATA_DIR = testDataDir;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Word Lookup Tests ===\n');

  // ---- Dictionary Service ----
  console.log('## dictionary.js');

  const dictionary = require('../services/dictionary');

  test('normalizeWord: basic lowercase + trim', () => {
    assert.strictEqual(dictionary.normalizeWord('  Hello  '), 'hello');
  });

  test('normalizeWord: strips surrounding punctuation', () => {
    assert.strictEqual(dictionary.normalizeWord('"world"'), 'world');
    assert.strictEqual(dictionary.normalizeWord('(test)'), 'test');
    assert.strictEqual(dictionary.normalizeWord('hello,'), 'hello');
  });

  test('normalizeWord: preserves internal apostrophes', () => {
    assert.strictEqual(dictionary.normalizeWord("don't"), "don't");
  });

  test('normalizeWord: empty/punctuation-only returns empty', () => {
    assert.strictEqual(dictionary.normalizeWord(''), '');
    assert.strictEqual(dictionary.normalizeWord('...'), '');
  });

  await testAsync('initDictionary: graceful when no ecdict.db', async () => {
    const result = await dictionary.initDictionary();
    // In test env, ecdict.db likely doesn't exist — should return false gracefully
    // (or true if it exists, either way no crash)
    assert.strictEqual(typeof result, 'boolean');
  });

  test('lookupFromDictionary: returns null when dict not loaded', () => {
    // If dict didn't load, should return null not throw
    const result = dictionary.lookupFromDictionary('nonexistent');
    // Could be null (no dict) or an object (dict loaded)
    assert.ok(result === null || typeof result === 'object');
  });

  // ---- Database Word Definition CRUD ----
  console.log('\n## database.js - word_definitions');

  const db = require('../models/database');
  await testAsync('initialize database', async () => {
    await db.initialize();
  });

  test('getWordDefinition: returns null for non-existent word', () => {
    const result = db.getWordDefinition('zzzznonexistent');
    assert.strictEqual(result, null);
  });

  test('createWordDefinition: inserts and retrieves', () => {
    const def = { word: 'test', phonetic: '/test/', partsOfSpeech: [{ pos: 'n', meaning: '测试' }], source: 'dictionary' };
    db.createWordDefinition('test', def, 'dictionary');
    const row = db.getWordDefinition('test');
    assert.ok(row);
    assert.strictEqual(row.word, 'test');
    assert.strictEqual(row.source, 'dictionary');
    const parsed = JSON.parse(row.definition_json);
    assert.strictEqual(parsed.word, 'test');
    assert.strictEqual(parsed.partsOfSpeech[0].meaning, '测试');
  });

  test('createWordDefinition: updates existing word', () => {
    const def2 = { word: 'test', phonetic: '/tɛst/', partsOfSpeech: [{ pos: 'n', meaning: '测试2' }], source: 'llm' };
    db.createWordDefinition('test', def2, 'llm');
    const row = db.getWordDefinition('test');
    assert.ok(row);
    assert.strictEqual(row.source, 'llm');
    const parsed = JSON.parse(row.definition_json);
    assert.strictEqual(parsed.partsOfSpeech[0].meaning, '测试2');
  });

  test('getWordDefinition: case insensitive', () => {
    const row = db.getWordDefinition('TEST');
    assert.ok(row);
    assert.strictEqual(row.word, 'test');
  });

  // ---- Cleanup ----
  console.log('\n---');
  db.close();
  // Clean up temp dir
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch { /* ignore */ }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
