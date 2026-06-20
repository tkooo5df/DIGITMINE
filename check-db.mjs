import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: pData, error: pErr } = await supabase.from('products').select('id').limit(1);
  console.log('Products table:', pErr ? pErr.message : 'EXISTS');
  
  const { data: countData, error: countErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
  console.log('Products count:', countErr ? countErr.message : countData);

  const { data: tData, error: tErr } = await supabase.from('telegram_processed_updates').select('update_id').limit(1);
  console.log('Telegram table:', tErr ? tErr.message : 'EXISTS');
}

check();
