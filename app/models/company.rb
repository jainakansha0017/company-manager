class Company < ApplicationRecord
  include BusinessEntity

  FINANCIAL_YEAR_FORMAT = /\A\d{4}\s*-\s*\d{2}(\d{2})?\z/

  # The register is this company's own and goes with it. The buyers and sellers
  # named in it are master data: they belong to no company and stay behind.
  has_many :saudas, dependent: :destroy

  validates :financial_year, presence: true,
                             format: { with: FINANCIAL_YEAR_FORMAT, message: "must look like 2025-26" }
  validates :pan, uniqueness: { case_sensitive: false }, allow_nil: true
  validates :gst_no, uniqueness: { case_sensitive: false }, if: :gst_registered?
end
