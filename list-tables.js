process.loadEnvFile('.env');
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Query information_schema to get all tables in public schema
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error('Products error:', error);
  } else {
    console.log('Products query success.');
  }
  
  // Since we can't easily query information_schema from REST without a view, let's just test common tables:
  const tables = ['products', 'product_offers', 'categories', 'orders', 'payment_receipts', 'profiles', 'telegram_users'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log(`Table ${t} is MISSING`);
    } else if (error) {
      console.log(`Table ${t} error:`, error.message);
    } else {
      console.log(`Table ${t} EXISTS`);
    }
  }
}
run();
