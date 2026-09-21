#!/usr/bin/env bash
# Render runs this on every deploy. Bail on the first failure so a broken build
# never replaces a working release.
set -o errexit

bundle install
yarn install --frozen-lockfile

# jsbundling-rails hooks `yarn build` into assets:precompile, so this builds the
# React bundle along with the sprockets assets.
bundle exec rails assets:precompile
bundle exec rails assets:clean

bundle exec rails db:migrate
