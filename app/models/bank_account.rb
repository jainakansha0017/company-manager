class BankAccount < ApplicationRecord
  IFSC_FORMAT = /\A[A-Z]{4}0[A-Z0-9]{6}\z/
  ACCOUNT_TYPES = %w[Savings Current OD CC].freeze

  # Owned by a Company, a Buyer or a Seller.
  belongs_to :accountable, polymorphic: true

  before_validation :normalise_attributes

  validates :bank_name, presence: true
  validates :account_number, presence: true,
                             format: { with: /\A[0-9]{6,20}\z/, message: "must be 6 to 20 digits" },
                             uniqueness: { scope: %i[accountable_type accountable_id],
                                           message: "is already added for this record" }
  validates :ifsc_code, format: { with: IFSC_FORMAT, message: "must look like HDFC0001234" },
                        allow_nil: true
  validates :account_type, inclusion: { in: ACCOUNT_TYPES }, allow_nil: true

  private

  def normalise_attributes
    self.ifsc_code = ifsc_code.strip.upcase if ifsc_code.present?
    self.ifsc_code = nil if ifsc_code.blank?
    self.account_type = nil if account_type.blank?
    self.branch = nil if branch.blank?
  end
end
