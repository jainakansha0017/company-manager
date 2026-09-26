#!/usr/bin/env bash
# Render runs this on every deploy. Bail on the first failure so a broken build
# never replaces a working release.
set -o errexit

# Ruby 3.1.0 ships RubyGems 3.3.3, which predates `Gem::Platform` understanding
# the libc suffix that nokogiri 1.18+ builds carry (x86_64-linux-gnu). Without
# this, bundler either refuses the gem outright or falls back to compiling from
# source, and the build dies. Match the versions the lockfile was resolved with.
gem update --system 3.4.22 --no-document
gem install bundler -v 2.6.9 --no-document

bundle install
yarn install --frozen-lockfile

# jsbundling-rails hooks `yarn build` into assets:precompile, so this builds the
# React bundle along with the sprockets assets.
bundle exec rails assets:precompile
bundle exec rails assets:clean

bundle exec rails db:migrate

# Rows written before pan/gst_no/account_number were encrypted are still
# plaintext; this rewrites them as ciphertext. Safe on every deploy — it's a
# cheap no-op once every row is migrated (see the task for why).
bundle exec rails data:encrypt_existing_data

# There is no sign-up, so the first user has to be made here or there is no way
# into the deployed app. The seed does nothing unless ADMIN_EMAIL and
# ADMIN_PASSWORD are set in the dashboard, and resets the password rather than
# failing if the user already exists — which is also the way back in if it is
# ever forgotten.
bundle exec rails db:seed
