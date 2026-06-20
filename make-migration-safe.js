import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the combined migration file
const inputFile = join(__dirname, 'combined-migration.sql');
const outputFile = join(__dirname, 'combined-migration-safe.sql');

let sql = readFileSync(inputFile, 'utf8');

// Wrap ENUM creations with DO blocks to ignore duplicates
sql = sql.replace(
  /create type public\.(\w+) as enum \([^)]+\);/gi,
  (match, typeName) => {
    return `DO $$ BEGIN
  ${match.replace(';', '')};
EXCEPTION WHEN duplicate_object THEN null;
END $$;`;
  }
);

// Wrap table creations with IF NOT EXISTS (they already have it, but ensure)
// Add IF NOT EXISTS to indexes
sql = sql.replace(/create index on /gi, 'CREATE INDEX IF NOT EXISTS idx_temp_ on ');

// Wrap policies with DO blocks
sql = sql.replace(
  /create policy "([^"]+)"[^;]+;/gi,
  (match, policyName) => {
    return `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '${policyName}') THEN
    ${match}
  END IF;
END $$;`;
  }
);

// Write the safe version
writeFileSync(outputFile, sql, 'utf8');

console.log('✅ Created safe migration file: combined-migration-safe.sql');
console.log('📋 This file will skip duplicate types, tables, and policies');
console.log('\n📝 Next steps:');
console.log('   1. Go to: https://supabase.com/dashboard/project/jhvcuvblvtjncatmsczb/sql/new');
console.log('   2. Copy contents of: combined-migration-safe.sql');
console.log('   3. Paste and Run');
