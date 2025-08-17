
# Loop Social Platform - Setup Instructions

## 🚀 Quick Start Guide

### 1. Database Setup (Critical - Do This First!)

1. **Go to your Supabase project dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste the entire contents of `scripts/complete-database-setup.sql`**
4. **Run the SQL script** - This will create all tables, functions, and policies

### 2. Environment Configuration

1. **Copy the environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Update `.env.local` with your actual values:**
   - Get Supabase URL and keys from your Supabase dashboard
   - Create a Cloudinary account for file uploads
   - Generate a strong JWT secret (32+ characters)
   - Configure other services as needed

### 3. Install Dependencies

Run the installation command that was provided above, or simply:
```bash
npm install
```

### 4. Start the Application

```bash
npm run dev
```

Your app will be available at `http://localhost:3000`

## 🔧 What Each Service Does

### Required Services:
- **Supabase**: Database, authentication, real-time features
- **Cloudinary**: File uploads (avatars, banners, media)

### Optional Services:
- **Stripe**: Payment processing for premium features
- **Google OAuth**: Social login
- **Analytics**: User behavior tracking

## ✅ Verification Checklist

After setup, verify these features work:

### Basic Features:
- [ ] User registration/login
- [ ] Creating loops (posts)
- [ ] Liking and commenting
- [ ] User profiles
- [ ] Search functionality

### Advanced Features:
- [ ] Shop system (themes, coins)
- [ ] Gift sending
- [ ] Real-time notifications
- [ ] File uploads
- [ ] Admin dashboard

## 🛠️ Troubleshooting

### Common Issues:

1. **Database errors**: Make sure you ran the complete SQL setup script
2. **File upload issues**: Check Cloudinary configuration
3. **Authentication issues**: Verify Supabase keys and RLS policies
4. **Real-time not working**: Check WebSocket configuration

### Testing Database Connection:

You can test your database setup by checking if these tables exist in Supabase:
- `profiles`
- `loops`
- `loop_stats`
- `shop_items`
- `gifts`
- `notifications`

## 🎯 Next Steps

Once everything is working:

1. **Customize themes** in `lib/theming/themes/`
2. **Add custom gifts** through the admin dashboard
3. **Configure payment processing** with Stripe
4. **Set up domain and SSL** for production
5. **Configure CDN** for better performance

## 📞 Support

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set
3. Ensure database script ran successfully
4. Check Supabase logs for authentication issues

Your Loop Social Platform should now be fully functional! 🎉
