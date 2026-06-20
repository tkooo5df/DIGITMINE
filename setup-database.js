import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTables() {
  console.log('🔧 Setting up database tables...\n');

  // Read SQL file
  const sql = readFileSync(join(__dirname, 'setup-tables.sql'), 'utf8');

  try {
    // Execute SQL via Supabase SQL API
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If RPC doesn't exist, we'll use REST API to create tables manually
      console.log('⚠️  Direct SQL not available, creating tables via API...\n');
      
      // Test if tables exist by trying to query them
      const { error: testError } = await supabase
        .from('products')
        .select('id')
        .limit(1);

      if (testError && testError.message.includes('Could not find')) {
        console.log('❌ Tables do not exist.');
        console.log('\n📋 Please run this SQL in your Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/yshmoyhebmqiqmorsmrj/sql');
        console.log('\n   Copy and paste the contents of: setup-tables.sql\n');
        return false;
      }

      console.log('✅ Tables already exist!');
      return true;
    }

    console.log('✅ Tables created successfully!');
    return true;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

setupTables().then(success => {
  if (success) {
    console.log('\n✨ Database setup complete!');
    console.log('You can now run: node --env-file=.env import-products-to-supabase.js\n');
  } else {
    console.log('\n⚠️  Please follow the instructions above to set up tables manually.\n');
  }
  process.exit(success ? 0 : 1);
});
