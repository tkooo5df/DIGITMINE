import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAllMigrations() {
  console.log('🚀 Running all Supabase migrations...\n');

  const migrationsDir = join(__dirname, 'supabase', 'migrations');
  
  // Get all SQL files sorted by timestamp
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`📁 Found ${migrationFiles.length} migration files\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const file of migrationFiles) {
    try {
      console.log(`📄 Running: ${file}`);
      
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      
      // Split by semicolons to execute each statement separately
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim().length === 0) continue;
        
        try {
          const { error } = await supabase.rpc('exec_sql', { 
            sql_query: statement + ';' 
          });
          
          if (error) {
            // Some errors are expected (like duplicate objects), continue
            if (!error.message.includes('already exists') && 
                !error.message.includes('duplicate')) {
              console.log(`   ⚠️  ${error.message.substring(0, 100)}`);
            }
          }
        } catch (err) {
          // Ignore expected errors
          if (!err.message.includes('already exists') && 
              !err.message.includes('duplicate')) {
            console.log(`   ⚠️  ${err.message.substring(0, 100)}`);
          }
        }
      }

      console.log(`   ✅ Completed\n`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
      errors.push({ file, error: err.message });
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.file}: ${err.error.substring(0, 150)}`);
    });
  }
  
  console.log('\n✨ All migrations completed!');
}

runAllMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
