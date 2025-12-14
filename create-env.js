const fs = require('fs');
const path = require('path');

const envContent = `# Server Configuration
PORT=3000
NODE_ENV=development

# Database - XAMPP MySQL Default
DATABASE_URL="mysql://root@localhost:3306/news_db"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars-please
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001

# Social Media Integration (Facebook/Instagram)
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
FACEBOOK_REDIRECT_URI=http://localhost:3001/api/social/oauth/facebook/callback
INSTAGRAM_REDIRECT_URI=http://localhost:3001/api/social/oauth/instagram/callback
FACEBOOK_WEBHOOK_VERIFY_TOKEN=
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=

# Redis/Caching Configuration (Optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false
CACHE_TTL_SECONDS=3600

# SEO Configuration
FRONTEND_URL=http://localhost:3000
SITE_NAME=NEWS NEXT
SITE_DESCRIPTION=Calabria's premier news portal
SITE_IMAGE=
`;

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Skipping creation.');
  console.log('   If you want to recreate it, delete the existing .env file first.');
} else {
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ .env file created successfully!');
  console.log('📝 Default MySQL URL: mysql://root@localhost:3306/news_db');
  console.log('   Make sure MySQL is running in XAMPP before running migrations.');
}

