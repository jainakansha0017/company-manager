# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn
]

# Regexps (anchored to the whole key), not plain strings: "pan" as a partial
# match also matches "company", filtering the entire company hash instead of
# just the one field.
Rails.application.config.filter_parameters += [
  /\Apan\z/, /\Agst_no\z/, /\Aaccount_number\z/
]
