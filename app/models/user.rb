# Someone who may sign in. Every user sees every company — this table decides
# who gets through the door, not what they find behind it.
#
# There is no sign-up: users are made from the console or db/seeds.rb, so the
# login form is the only way in and the only thing exposed to the internet.
class User < ApplicationRecord
  MINIMUM_PASSWORD_LENGTH = 12

  has_secure_password

  # The handle every open session hangs off. It goes into the cookie beside the
  # user's id and is checked on every request, so regenerating it shuts every
  # session at once — which is what signing in on a second device, or out on any
  # of them, does. One device at a time, by design.
  has_secure_token :session_token

  before_validation :normalise_email

  validates :name, presence: true, length: { maximum: 255 }
  validates :email, presence: true, uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP, message: "is not a valid email address" }

  # `has_secure_password` already requires a password on create and confirms it
  # when given. Length is on top of that, and only when one is being set, so
  # saving an existing user does not demand the password be retyped.
  validates :password, length: { minimum: MINIMUM_PASSWORD_LENGTH }, allow_nil: true

  # Stored downcased so the unique index does the case-insensitive work, and so
  # signing in does not depend on how the address was typed.
  def self.authenticate(email:, password:)
    find_by(email: email.to_s.strip.downcase)&.authenticate(password) || nil
  end

  private

  def normalise_email
    self.email = email.strip.downcase if email.present?
  end
end
