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

// Connect to Supabase (source)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Connect to Fly PostgreSQL (destination)
const flyPool = new Pool({
  connectionString: FLY_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Tables to import (in order to respect foreign keys)
const TABLES = [
  'categories',
  'products',
  'product_offers',
  'product_reviews',
  'profiles',
  'user_roles',
  'orders',
  'order_messages',
  'coupons',
  'site_settings',
  'exchange_rate',
  'payment_methods'
];

// Helper to delete all data from table
async function clearTable(tableName) {
  try {
    await flyPool.query(`DELETE FROM ${tableName}`);
    console.log(`  🗑️  Cleared ${tableName}`);
  } catch (err) {
    console.log(`  ⚠️  Could not clear ${tableName} (might not exist yet): ${err.message}`);
  }
}

// Helper to insert data into Fly PostgreSQL
async function insertToFly(tableName, rows) {
  if (rows.length === 0) {
    console.log(`  ⏭️  No data to import`);
    return { status: 'skipped', count: 0 };
  }
  
  console.log(`  📊 Importing ${rows.length} rows...`);
  
  try {
    // Build INSERT query
    const columns = Object.keys(rows[0]);
    const columnNames = columns.join(', ');
    const valuesPlaceholder = rows.map((_, i) => {
      return `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`;
    }).join(', ');
    
    const values = rows.flatMap(row => 
      columns.map(col => row[col] === null ? null : row[col])
    );
    
    const query = `INSERT INTO ${tableName} (${columnNames}) VALUES ${valuesPlaceholder} ON CONFLICT (id) DO UPDATE SET ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`;
    
    await flyPool.query(query, values);
    
    console.log(`  ✅ Imported ${rows.length} rows`);
    return { status: 'success', count: rows.length };
    
  } catch (err) {
    console.error(`  ❌ Error importing ${tableName}:`, err.message);
    return { status: 'error', error: err.message, count: 0 };
  }
}

async function importTable(tableName) {
  try {
    console.log(`\n📦 Importing: ${tableName}`);
    
    // Fetch all data from Supabase
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`  ❌ Error fetching from Supabase:`, error.message);
      return { table: tableName, status: 'error', error: error.message, count: 0 };
    }
    
    if (!data || data.length === 0) {
      console.log(`  ⏭️  Empty table in Supabase, skipping`);
      return { table: tableName, status: 'skipped', count: 0 };
    }
    
    console.log(`  📊 Found ${data.length} rows in Supabase`);
    
    // Clear existing data in Fly
    await clearTable(tableName);
    
    // Insert into Fly PostgreSQL
    const result = await insertToFly(tableName, data);
    
    return { table: tableName, ...result };
    
  } catch (err) {
    console.error(`  ❌ Failed to import ${tableName}:`, err.message);
    return { table: tableName, status: 'error', error: err.message, count: 0 };
  }
}

async function runImport() {
  const startTime = Date.now();
  const results = [];
  
  console.log('🚀 Starting data import from Supabase to Fly PostgreSQL...');
  console.log('='.repeat(50));
  
  // Import each table
  for (const table of TABLES) {
    const result = await importTable(table);
    results.push(result);
  }
  
  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const totalRows = results.reduce((sum, r) => sum + (r.count || 0), 0);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Import Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successCount} tables`);
  console.log(`❌ Errors: ${errorCount} tables`);
  console.log(`⏭️  Skipped: ${skippedCount} tables`);
  console.log(`📈 Total rows imported: ${totalRows}`);
  console.log(`⏱️  Duration: ${duration}s`);
  
  if (errorCount > 0) {
    console.log('\n❌ Errors:');
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`  - ${r.table}: ${r.error}`);
    });
  }
  
  const timestamp = new Date().toISOString();
  console.log(`\n💾 Import completed at: ${timestamp}`);
  
  // Close connections
  await flyPool.end();
  
  if (errorCount > 0) {
    process.exit(1);
  } else {
    console.log('\n✨ Import completed successfully!');
    process.exit(0);
  }
}

// Run import
runImport().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
