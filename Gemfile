source "https://rubygems.org"

ruby "3.1.0"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 7.1.6"

# The original asset pipeline for Rails [https://github.com/rails/sprockets-rails]
gem "sprockets-rails"

# Use postgresql as the database for Active Record
gem "pg", "~> 1.5"

# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"

# Bundle and transpile JavaScript [https://github.com/rails/jsbundling-rails]
gem "jsbundling-rails"

# json 3.x dropped the `quirks_mode` keyword that ActiveSupport::JSON still
# passes, which breaks every `render json:` on Rails < 7.2.
gem "json", "~> 2.7"

# railties pulls in irb, which pulls in rdoc, which pulls in erb. Left alone
# that resolves to erb 4, which wants cgi >= 0.3.3 — but Ruby 3.1.0 ships cgi
# 0.3.1 as a default gem, and on a clean install RubyGems activates that one
# first, so the deploy dies with "Unable to activate erb-4.0.4.1, because
# cgi-0.3.1 conflicts". Pinning erb to the version Ruby 3.1 ships satisfies
# rdoc without dragging in a cgi this Ruby cannot provide.
gem "erb", "~> 2.2"

# Use Redis adapter to run Action Cable in production
# gem "redis", ">= 4.0.1"

# Use Kredis to get higher-level data types in Redis [https://github.com/rails/kredis]
# gem "kredis"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
gem "bcrypt", "~> 3.1.7"

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
# gem "image_processing", "~> 1.2"

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ]

  gem "rspec-rails", "~> 6.1"
  gem "factory_bot_rails"

  # Loads .env so database credentials stay out of version control.
  gem "dotenv-rails"
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem "web-console"

  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  # gem "rack-mini-profiler"

  # Speed up commands on slow machines / big apps [https://github.com/rails/spring]
  # gem "spring"

  gem "error_highlight", ">= 0.4.0", platforms: [:ruby]
end

