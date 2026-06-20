import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const productsData = JSON.parse(readFileSync(join(__dirname, 'all_products.json'), 'utf8'));

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set environment variables:');
  console.error('  - VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_PUBLISHABLE_KEY');
  console.error('');
  console.error('Note: For production use, always use SUPABASE_SERVICE_ROLE_KEY for admin operations!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importProducts() {
  console.log('🚀 Starting product import to Supabase...');
  console.log(`📦 Total products to import: ${productsData.total_products}`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Group products by family to create parent products
  const familyMap = new Map();
  
  for (const product of productsData.products) {
    const family = product.family || 'Other';
    if (!familyMap.has(family)) {
      familyMap.set(family, []);
    }
    familyMap.get(family).push(product);
  }

  console.log(`\n📊 Found ${familyMap.size} product families`);

  // Import each family as a product with multiple offers
  for (const [familyName, familyProducts] of familyMap) {
    try {
      // Create slug from family name
      const slug = familyName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if product already exists
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('slug', slug)
        .single();

      let productId;

      if (existingProduct) {
        console.log(`\n⏭️  Product already exists: ${familyName}`);
        productId = existingProduct.id;
      } else {
        // Create parent product
        const firstProduct = familyProducts[0];
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            name: familyName,
            slug: slug,
            description: firstProduct.description,
            main_image: firstProduct.logo_url,
            visible: true,
            featured: false,
            delivery_type: 'manual',
          })
          .select()
          .single();

        if (error) {
          console.error(`❌ Error creating product ${familyName}:`, error.message);
          errors.push({ family: familyName, error: error.message });
          errorCount++;
          continue;
        }

        productId = newProduct.id;
        console.log(`✅ Created product: ${familyName} (${slug})`);
      }

      // Create offers for each product variant
      for (const product of familyProducts) {
        const offerName = `${product.title}`;
        
        // Check if offer already exists
        const { data: existingOffer } = await supabase
          .from('product_offers')
          .select('id')
          .eq('product_id', productId)
          .eq('name', offerName)
          .eq('duration', product.duration)
          .single();

        if (existingOffer) {
          console.log(`  ⏭️  Offer exists: ${offerName}`);
          continue;
        }

        const { error: offerError } = await supabase
          .from('product_offers')
          .insert({
            product_id: productId,
            name: offerName,
            duration: product.duration,
            price_usd: product.price_usd,
            price_dzd: product.price_dzd,
            stock: Math.floor(Math.random() * 50) + 10, // Random stock between 10-60
            delivery_type: 'manual',
            active: product.active !== false,
            account_type: product.account_type,
            offer_type: product.offer_type,
            original_title: product.original_title,
            supplier: product.supplier,
            product_url: product.product_url,
            delivery_method: product.delivery_method,
          });

        if (offerError) {
          console.error(`  ❌ Error creating offer ${offerName}:`, offerError.message);
          errors.push({ offer: offerName, error: offerError.message });
          errorCount++;
        } else {
          console.log(`  ✅ Created offer: ${offerName} - ${product.price_dzd} DA`);
          successCount++;
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${familyName}:`, err.message);
      errors.push({ family: familyName, error: err.message });
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Import Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Successful offers: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.family || err.offer}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Import completed!');
}

importProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
