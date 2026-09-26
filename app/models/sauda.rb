# One entry in a company's sauda register: what was sold, to whom, under which
# marks. Quantities live on the mark/grade rows; `total_kg` is derived from them.
class Sauda < ApplicationRecord
  # Not required: nothing maps a sauda to a company yet (a seller may end up
  # carrying that link instead), and the financial year is worked out from
  # `sauda_date` rather than the company's own, so nothing else depends on it.
  belongs_to :company, optional: true
  belongs_to :seller
  belongs_to :buyer

  has_many :sauda_marks, dependent: :destroy
  accepts_nested_attributes_for :sauda_marks, allow_destroy: true

  GST_RATE = BigDecimal("0.05")
  BROKERAGE_RATE = BigDecimal("0.01")

  before_validation :set_total_kg
  before_validation :set_amounts

  validates :sauda_date, presence: true
  validates :tax_invoice_no, :destination, :sauda_no, :transporter_name, :bilty_no,
            length: { maximum: 255 }
  validates :amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :discount_percent,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
            allow_nil: true
  validate :must_have_a_mark

  scope :ordered, -> { order(sauda_date: :desc, id: :desc) }

  # "2025-2026" is 1 April 2025 to 31 March 2026. The short "2025-26" is read the
  # same way, since only the four digits it starts with are used. Anything that is
  # not a year narrows nothing, which is what "All years" asks for.
  scope :in_financial_year, lambda { |label|
    start = label.to_s[/\A\d{4}/]
    next all if start.blank?

    where(sauda_date: Date.new(start.to_i, 4, 1)..Date.new(start.to_i + 1, 3, 31))
  }

  # Which financial year this sauda falls in, written out in full. India's runs
  # April to March, so a sauda dated 12 May 2025 and one dated 3 February 2026 are
  # both "2025-2026".
  def financial_year
    return if sauda_date.blank?

    start = sauda_date.month < 4 ? sauda_date.year - 1 : sauda_date.year
    "#{start}-#{start + 1}"
  end

  private

  def live_marks
    sauda_marks.reject(&:marked_for_destruction?)
  end

  def set_total_kg
    self.total_kg = live_marks.sum(&:total_kg)
  end

  # The bill is a chain, and only the discount percentage is typed in. The amount
  # is the grades priced at their rates, the discount comes off that, and GST goes
  # on what is left. Every step is stored but none is entered, so a stored bill
  # can always be traced back to the kilos and rates it came from. Rounded at each
  # step rather than only at the end, so the columns add up as they read on screen.
  def set_amounts
    self.amount = live_marks.filter_map(&:amount).then { |priced| priced.sum if priced.any? }

    # Clearing the rates clears the bill with them, rather than leaving the
    # figures from the last time it was priced.
    if amount.blank?
      self.disc_amt = self.taxable_value = self.gst_amt = self.total_tax_bill_amt = nil
      self.brokerage_amt = nil
      return
    end

    self.disc_amt = (amount * discount_percent.to_d / 100).round(2)
    self.taxable_value = (amount - disc_amt).round(2)
    self.gst_amt = (taxable_value * GST_RATE).round(2)
    self.total_tax_bill_amt = (taxable_value + gst_amt).round(2)
    self.brokerage_amt = set_brokerage_amt
  end

  # The broker takes one per cent, but of which figure is the seller's own
  # arrangement: some are dealt with on the goods, some on what is taxed after
  # the discount. A seller with no arrangement recorded has no brokerage.
  def set_brokerage_amt
    case seller&.brokerage_basis
    when "amount" then (amount * BROKERAGE_RATE).round(2)
    when "taxable_value" then (taxable_value * BROKERAGE_RATE).round(2)
    end
  end

  def must_have_a_mark
    return if live_marks.any?

    errors.add(:sauda_marks, "must include at least one mark")
  end
end
