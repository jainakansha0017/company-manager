# Base class for the firms that are traded with. Buyer and Seller share every
# field, so they live in one table distinguished by `type` (STI).
# Abstract in spirit: always use Buyer or Seller, never Party directly.
#
# Master data: one list of buyers and one of sellers, shared by every company.
# A firm is the same firm whoever is dealing with it, so it is recorded once
# rather than re-entered under each company that trades with it.
class Party < ApplicationRecord
  include BusinessEntity

  ROLES = %w[Buyer Seller].freeze

  validates :type, inclusion: { in: ROLES }
  validates :pan, uniqueness: { scope: :type, case_sensitive: false },
                  allow_nil: true
  validates :gst_no, uniqueness: { scope: :type, case_sensitive: false },
                     if: :gst_registered?

  scope :ordered, -> { order(name: :asc) }

  # "Buyer" / "Seller" — handy for messages and serialisation.
  def role
    type
  end
end
