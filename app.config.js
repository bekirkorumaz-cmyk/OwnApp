const appJson = require('./app.json');

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  name: appJson.expo.name || 'OwnApp',
  slug: appJson.expo.slug || 'THE_RHYTHM',
  extra: {
    ...(appJson.expo.extra || {}),
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
});
