# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# There is no sign-up, so the first user has to be made here. The credentials
# are read from the environment rather than written down — this repo is public,
# and a password committed to it would be a password given away.
#
#   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' bin/rails db:seed
#
# Re-running resets the password of an existing user rather than failing, so it
# doubles as the way back in if one is forgotten.
email = ENV["ADMIN_EMAIL"].presence
password = ENV["ADMIN_PASSWORD"].presence

if email && password
  user = User.find_or_initialize_by(email: email.strip.downcase)
  user.name = ENV.fetch("ADMIN_NAME", user.name.presence || "Admin")
  user.password = password
  user.save!
  puts "Seeded user #{user.email}"
else
  puts "Skipped the user seed. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one."
end
