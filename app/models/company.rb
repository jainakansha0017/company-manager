class Company < ApplicationRecord
  include BusinessEntity

  # Both years in full, the way the sauda register writes them.
  FINANCIAL_YEAR_FORMAT = /\A\d{4}-\d{4}\z/

  # What a financial year may be typed as: "2025-26", "2025 - 2026" and
  # "2025-2026" are all the same year, and all end up stored the long way.
  TYPED_FINANCIAL_YEAR = /\A(\d{4})\s*-\s*(\d{2}|\d{4})\z/

  # The register is this company's own and goes with it. The buyers and sellers
  # named in it are master data: they belong to no company and stay behind.
  has_many :saudas, dependent: :destroy

  before_validation :normalise_financial_year

  validates :financial_year, presence: true,
                             format: { with: FINANCIAL_YEAR_FORMAT, message: "must look like 2025-2026" }
  # Case-sensitive: pan/gst_no are encrypted deterministically, which cannot
  # support a case-insensitive DB comparison. Harmless in practice since
  # BusinessEntity#normalise_attributes always upcases both before validation.
  validates :pan, uniqueness: true, allow_nil: true
  validates :gst_no, uniqueness: true, if: :gst_registered?

  private

  # A year typed the short way is written out in full, so the company's own
  # financial year reads the same as the ones on its sauda register. The second
  # half is the century of the first plus the two digits given, which keeps
  # "2099-00" meaning 2100 rather than the year nineteen hundred.
  def normalise_financial_year
    match = TYPED_FINANCIAL_YEAR.match(financial_year.to_s.strip)
    return if match.nil?

    start, finish = match.captures
    finish = format("%d%02d", start.to_i.next / 100, finish.to_i) if finish.length == 2
    self.financial_year = "#{start}-#{finish}"
  end
end
