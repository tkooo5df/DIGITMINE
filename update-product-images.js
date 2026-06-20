import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
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

// Mapping of product families to their image files
const familyImageMap = {
  'Adobe Creative Cloud': '/products/adobe-cc.jpg',
  'Amazon Prime Video': '/products/prime-video.jpg',
  'Antigravity Slot': '/products/antigravity.jpg',
  'Brazzers': '/products/brazzers-premium.jpg',
  'Canva': '/products/canva-pro.jpg',
  'Capcut': '/products/capcut-pro.jpg',
  'ChatGPT': '/products/chatgpt-plus.jpg',
  'Claude': '/products/claude-ai.jpg',
  'Crunchyroll': '/products/crunchyroll-premium.jpg',
  'Cursor': '/products/cursor-pro.jpg',
  'DeepSeek': '/products/chatgpt-cheap.jpg',
  'Discord': '/products/chatgpt-plus.jpg',
  'Disney+': '/products/netflix-premium.jpg',
  'Dreamina': '/products/ultra-veo3.jpg',
  'Duolingo': '/products/duolingo-premium.jpg',
  'ElevenLabs': '/products/elevenlabs.jpg',
  'F*P House': '/products/faphouse-premium.jpg',
  'Figma': '/products/canva-pro.jpg',
  'GTA V': '/products/pubg-uc-660.jpg',
  'Games': '/products/pubg-uc-660.jpg',
  'Gamma': '/products/lovable-credits.jpg',
  'Gemini': '/products/gemini-pro.jpg',
  'GitHub': '/products/github-student-pack.jpg',
  'Gmail': '/products/microsoft-office-365.jpg',
  'Grammarly': '/products/grammarly-premium.jpg',
  'Headspace': '/products/headspace-premium.jpg',
  'HeyGen': '/products/ultra-veo3.jpg',
  'HiggsField': '/products/ultra-veo3.jpg',
  'Kling AI': '/products/kling-ai.jpg',
  'LinkedIn': '/products/linkedin-premium.jpg',
  'Lovable': '/products/lovable-credits.jpg',
  'Loveable Lite': '/products/lovable-credits.jpg',
  'Netflix': '/products/netflix-premium.jpg',
  'Nord VPN': '/products/nordvpn-premium.jpg',
  'Notion': '/products/notion-business.jpg',
  'Outlook': '/products/microsoft-office-365.jpg',
  'Paramount+': '/products/prime-video.jpg',
  'Perplexity AI': '/products/perplexity-pro.jpg',
  'QuillBot': '/products/quillbot-premium.jpg',
  'Replit': '/products/replit-core.jpg',
  'SMS Panel': '/products/sms-panel.jpg',
  'Spotify': '/products/spotify-premium.jpg',
  'Steam': '/products/pubg-uc-660.jpg',
  'Suno': '/products/elevenlabs.jpg',
  'SuperGrok': '/products/super-grok.jpg',
  'Surfshark': '/products/surfshark-vpn.jpg',
  'TikTok': '/products/chatgpt-plus.jpg',
  'TradingView': '/products/tradingview-premium.jpg',
  'Trail Cards': '/products/pubg-uc-660.jpg',
  'Xbox': '/products/pubg-uc-660.jpg',
  'YouTube Premium': '/products/youtube-premium.jpg',
  'أخرى': '/products/chatgpt-plus.jpg',
};

async function updateProductImages() {
  console.log('🖼️  Updating product images...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const [familyName, imageUrl] of Object.entries(familyImageMap)) {
    try {
      const slug = familyName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data, error } = await supabase
        .from('products')
        .update({ main_image: imageUrl })
        .eq('slug', slug);

      if (error) {
        console.error(`❌ ${familyName}: ${error.message}`);
        errors.push({ family: familyName, error: error.message });
        errorCount++;
      } else {
        console.log(`✅ ${familyName} → ${imageUrl}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ ${familyName}: ${err.message}`);
      errors.push({ family: familyName, error: err.message });
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Image Update Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Updated: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.family}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Image update completed!');
}

updateProductImages().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
