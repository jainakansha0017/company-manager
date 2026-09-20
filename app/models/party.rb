# Base class for the entities a company trades with. Buyer and Seller share
# every field, so they live in one table distinguished by `type` (STI).
# Abstract in spirit: always use Buyer or Seller, never Party directly.
class Party < ApplicationRecord
  include BusinessEntity

  ROLES = %w[Buyer Seller].freeze

  belongs_to :company

  validates :type, inclusion: { in: ROLES }
  validates :pan, uniqueness: { scope: %i[company_id type], case_sensitive: false },
                  allow_nil: true
  validates :gst_no, uniqueness: { scope: %i[company_id type], case_sensitive: false },
                     if: :gst_registered?

  scope :ordered, -> { order(name: :asc) }

  # "Buyer" / "Seller" — handy for messages and serialisation.
  def role
    type
  end
end
