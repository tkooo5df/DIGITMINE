import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing anonymous queries...');
  
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, name, visible')
    .limit(5);

  if (pError) {
    console.error('❌ Products query failed:', pError.message);
  } else {
    console.log(`✅ Products query successful. Fetched ${products.length} products:`);
    products.forEach(p => console.log(`  - ${p.name} (ID: ${p.id}, Visible: ${p.visible})`));
  }

  const { data: categories, error: cError } = await supabase
    .from('categories')
    .select('id, name')
    .limit(5);

  if (cError) {
    console.error('❌ Categories query failed:', cError.message);
  } else {
    console.log(`✅ Categories query successful. Fetched ${categories.length} categories.`);
  }
}

test();
