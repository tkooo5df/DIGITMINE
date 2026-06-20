import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Sample Arabic review content
const reviewContents = [
  'منتج ممتاز وسريع التسليم!',
  'خدمة عملاء رائعة، أنصح بالتعامل معهم',
  'السعر مناسب جداً والجودة عالية',
  'تم التسليم خلال دقائق، شكراً لكم!',
  'أفضل متجر للمنتجات الرقمية في الجزائر',
  'تعامل احترافي ومنتج أصلي 100%',
  'سعر منافس وخدمة سريعة',
  'جربت منتجات كثيرة من هنا وكلها ممتازة',
  'الدفع سهل والتسليم فوري',
  'أنصح الجميع بالتعامل مع هذا المتجر',
  'منتج رائع وخدمة ما بعد البيع ممتازة',
  'سرعة في التنفيذ وجودة عالية',
  'شكراً على الخدمة الممتازة!',
  'سعر عادل ومنتج يعمل بشكل مثالي',
  'تجربة شراء رائعة، سأعود للشراء مرة أخرى',
];

const reviewNames = [
  'أحمد ب.',
  'محمد ك.',
  'ياسين م.',
  'عمر ف.',
  'خالد ع.',
  'عبدالله ر.',
  'سامي ح.',
  'فهد س.',
  'ناصر د.',
  'حسن ش.',
  'إبراهيم ل.',
  'يوسف ت.',
  'طارق ج.',
  'مصطفى و.',
  'علي ق.',
];

async function addSampleReviews() {
  console.log('⭐ Adding sample reviews...\n');

  // Get all products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name');

  if (productsError) {
    console.error('❌ Error fetching products:', productsError.message);
    process.exit(1);
  }

  console.log(`📦 Found ${products.length} products\n`);

  let totalReviews = 0;
  let successCount = 0;
  let errorCount = 0;

  // Add 2-5 reviews per product
  for (const product of products) {
    const numReviews = Math.floor(Math.random() * 4) + 2; // 2-5 reviews

    for (let i = 0; i < numReviews; i++) {
      const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars
      const content = reviewContents[Math.floor(Math.random() * reviewContents.length)];
      const name = reviewNames[Math.floor(Math.random() * reviewNames.length)];

      const { error } = await supabase.from('product_reviews').insert({
        product_id: product.id,
        user_name: name,
        rating: rating,
        content: content,
        verified_purchase: Math.random() > 0.3, // 70% verified
      });

      if (error) {
        errorCount++;
      } else {
        successCount++;
        totalReviews++;
      }
    }

    if (successCount % 20 === 0) {
      console.log(`✅ Added ${successCount} reviews so far...`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Reviews Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Total reviews added: ${totalReviews}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📈 Average per product: ${(totalReviews / products.length).toFixed(1)}`);
  console.log('\n✨ Reviews added successfully!');
}

addSampleReviews().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
