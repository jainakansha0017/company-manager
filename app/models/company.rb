class Company < ApplicationRecord
  include BusinessEntity

  FINANCIAL_YEAR_FORMAT = /\A\d{4}\s*-\s*\d{2}(\d{2})?\z/

  # Declared first on purpose: deleting a company clears its register before it
  # reaches the parties, which otherwise refuse to go while saudas reference them.
  has_many :saudas, dependent: :destroy
  has_many :buyers, dependent: :destroy
  has_many :sellers, dependent: :destroy

  validates :financial_year, presence: true,
                             format: { with: FINANCIAL_YEAR_FORMAT, message: "must look like 2025-26" }
  validates :pan, uniqueness: { case_sensitive: false }, allow_nil: true
  validates :gst_no, uniqueness: { case_sensitive: false }, if: :gst_registered?
end
