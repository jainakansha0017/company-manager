# Rewrites pan/gst_no/account_number as ciphertext, for rows written before
# these columns were encrypted. Safe to run every deploy: `record.encrypt`
# writes via `update_columns`, which skips validations/callbacks and does not
# touch `updated_at`, so re-running it against already-encrypted rows is cheap
# and has no visible side effect.
namespace :data do
  desc "Encrypt any pan/gst_no/account_number values still stored as plaintext"
  task encrypt_existing_data: :environment do
    # Lets the read below succeed on rows that predate encryption, instead of
    # raising as soon as a plaintext value is treated as ciphertext.
    ActiveRecord::Encryption.config.support_unencrypted_data = true

    [Company, Party, BankAccount].each do |klass|
      klass.find_each(&:encrypt)
    end
  end
end
