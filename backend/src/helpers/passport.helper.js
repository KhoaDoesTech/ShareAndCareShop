const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const AuthService = require('../services/auth.service');
const { UserLoginType } = require('../constants/status');

const authService = new AuthService();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { email, name, picture, sub } = profile._json;

        const user = {
          avatar: picture,
          email,
          password: sub,
          username: name,
          loginType: UserLoginType.GOOGLE,
        };

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'emails', 'name', 'photos'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0].value;
        const username = `${profile.name.givenName} ${profile.name.familyName}`;
        const avatar = profile.photos && profile.photos[0].value;
        const password = profile.id;

        const user = {
          email,
          avatar,
          password,
          username,
          loginType: UserLoginType.FACEBOOK,
        };

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

module.exports = passport;
