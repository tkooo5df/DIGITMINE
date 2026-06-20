import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

// Environment variables
const FLY_DATABASE_URL = process.env.FLY_DATABASE_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!FLY_DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: FLY_DATABASE_URL, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Connect to Fly PostgreSQL (source)
const flyPool = new Pool({
  connectionString: FLY_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Connect to Supabase (backup destination)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Tables to backup
const TABLES = [
  'profiles',
  'categories',
  'products',
  'product_offers',
  'product_reviews',
  'orders',
  'order_messages',
  'coupons',
  'site_settings',
  'exchange_rate',
  'payment_methods',
  'user_roles'
];

async function backupTable(tableName) {
  try {
    console.log(`📦 Backing up: ${tableName}`);
    
    // Fetch all data from Fly PostgreSQL
    const { rows } = await flyPool.query(`SELECT * FROM ${tableName}`);
    
    if (rows.length === 0) {
      console.log(`  ⏭️  Empty table, skipping`);
      return { table: tableName, status: 'skipped', count: 0 };
    }
    
    console.log(`  📊 Found ${rows.length} rows`);
    
    // Upsert to Supabase
    const { error } = await supabase
      .from(tableName)
      .upsert(rows, { onConflict: 'id' });
    
    if (error) {
      console.error(`  ❌ Error backing up ${tableName}:`, error.message);
      return { table: tableName, status: 'error', error: error.message, count: rows.length };
    }
    
    console.log(`  ✅ Successfully backed up ${rows.length} rows`);
    return { table: tableName, status: 'success', count: rows.length };
    
  } catch (err) {
    console.error(`  ❌ Failed to backup ${tableName}:`, err.message);
    return { table: tableName, status: 'error', error: err.message, count: 0 };
  }
}

async function runBackup() {
  const startTime = Date.now();
  const results = [];
  
  console.log('🚀 Starting daily backup to Supabase...');
  console.log('=' .repeat(50));
  
  // Backup each table
  for (const table of TABLES) {
    const result = await backupTable(table);
    results.push(result);
  }
  
  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const totalRows = results.reduce((sum, r) => sum + (r.count || 0), 0);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Backup Summary:');
  console.log('=' .repeat(50));
  console.log(`✅ Successful: ${successCount} tables`);
  console.log(`❌ Errors: ${errorCount} tables`);
  console.log(`⏭️  Skipped: ${skippedCount} tables`);
  console.log(`📈 Total rows: ${totalRows}`);
  console.log(`⏱️  Duration: ${duration}s`);
  
  if (errorCount > 0) {
    console.log('\n❌ Errors:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`  - ${r.table}: ${r.error}`);
    });
  }
  
  // Log backup timestamp
  const timestamp = new Date().toISOString();
  console.log(`\n💾 Backup completed at: ${timestamp}`);
  
  // Close connections
  await flyPool.end();
  
  if (errorCount > 0) {
    process.exit(1);
  } else {
    console.log('\n✨ Backup completed successfully!');
    process.exit(0);
  }
}

// Run backup
runBackup().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
