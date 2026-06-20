import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationsDir = join(__dirname, 'supabase', 'migrations');

// Get all SQL files sorted by timestamp
const migrationFiles = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort();

console.log(`📁 Merging ${migrationFiles.length} migration files...\n`);

let combinedSQL = '-- ============================================\n';
combinedSQL += '-- Combined Migration File\n';
combinedSQL += `-- Generated: ${new Date().toISOString()}\n`;
combinedSQL += `-- Total Files: ${migrationFiles.length}\n`;
combinedSQL += '-- ============================================\n\n';

for (const file of migrationFiles) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  
  combinedSQL += `-- ============================================\n`;
  combinedSQL += `-- Migration: ${file}\n`;
  combinedSQL += `-- ============================================\n\n`;
  combinedSQL += sql + '\n\n';
}

const outputPath = join(__dirname, 'combined-migration.sql');
writeFileSync(outputPath, combinedSQL, 'utf8');

console.log(`✅ Combined migration file created: combined-migration.sql`);
console.log(`📊 File size: ${(combinedSQL.length / 1024).toFixed(2)} KB`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Go to: https://supabase.com/dashboard/project/jhvcuvblvtjncatmsczb/sql/new`);
console.log(`   2. Copy contents of: combined-migration.sql`);
console.log(`   3. Paste in SQL Editor and click Run`);
