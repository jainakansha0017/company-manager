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

  has_many :sauda_bills, dependent: :destroy
  accepts_nested_attributes_for :sauda_bills, allow_destroy: true

  GST_RATE = BigDecimal("0.05")
  BROKERAGE_RATE = BigDecimal("0.01")

  before_validation :set_total_kg
  before_validation :set_amounts
  before_validation :recalculate_bills
  after_validation :set_bill_totals

  validates :sauda_date, presence: true
  validates :destination, :sauda_no, :transporter_name, :bilty_no, length: { maximum: 255 }
  validates :amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :credit_due, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  # A sauda no. names one deal, and the same number turning up twice anywhere
  # in the application almost always means two entries for the one sauda.
  validates :sauda_no, uniqueness: { case_sensitive: false }, allow_blank: true
  validate :must_have_a_mark
  validate :bills_must_not_share_a_lot_no

  # Latest sauda date first; within the same date, sauda no. descending too.
  scope :ordered, -> { order(sauda_date: :desc, sauda_no: :desc) }

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

  # Which of this sauda's grades a bill is responsible for: every live grade
  # of every live mark, when it has been given no lot nos of its own and it is
  # the only bill there is ("All", covering every lot by definition, since
  # nothing else exists to bill the rest); otherwise, from each live mark,
  # only the grade entered in the same position as a lot no. the bill was
  # given — the first grade typed prices the first lot, the second grade the
  # second lot, and so on — none at all, until it's given any lot nos, rather
  # than every lot by default.
  def grades_for_bill(bill)
    return live_marks.flat_map(&:live_grades) if bill.lot_no_list.empty? && live_bills.size <= 1

    live_marks.flat_map { |mark| bill.lot_no_list.filter_map { |lot_no| mark.grade_for_lot(lot_no) } }
  end

  private

  def live_marks
    sauda_marks.reject(&:marked_for_destruction?)
  end

  def set_total_kg
    self.total_kg = live_marks.sum(&:total_kg)
  end

  # Just the grades priced at their rates, added up across every mark. What
  # becomes of it — discount, GST, the bill total — is each live bill's own
  # concern now, since a split sauda can carry more than one.
  def set_amounts
    self.amount = live_marks.filter_map(&:amount).then { |priced| priced.sum if priced.any? }
  end

  # The sauda's own totals are just what its live bills add up to, so any
  # figure here can always be traced to one bill or another rather than to a
  # single discount no bill actually carries any more.
  def set_bill_totals
    self.disc_amt = sum_of_bills(:disc_amt)
    self.taxable_value = sum_of_bills(:taxable_value)
    self.gst_amt = sum_of_bills(:gst_amt)
    self.total_tax_bill_amt = sum_of_bills(:total_tax_bill_amt)
    self.brokerage_amt = sum_of_bills(:brokerage_amt)
  end

  def sum_of_bills(attribute)
    values = live_bills.filter_map(&attribute)
    values.sum.round(2) if values.any?
  end

  def must_have_a_mark
    return if live_marks.any?

    errors.add(:sauda_marks, "must include at least one mark")
  end

  def live_bills
    sauda_bills.reject(&:marked_for_destruction?)
  end

  # Keeps every live bill's own figures in step with this sauda's amount and
  # kilos, even when only a mark changed and the bill itself was never
  # directly touched — Rails' own autosave validation skips an association
  # member it does not consider "changed", so this cannot be left to that.
  def recalculate_bills
    live_bills.each(&:recalculate_amounts)
  end

  # Once a sauda is split into more than one bill, which lot it is billed
  # under stops being implicit, so each bill must say which lots it covers,
  # and no lot can be claimed by more than one bill.
  def bills_must_not_share_a_lot_no
    return if live_bills.size <= 1

    seen = Hash.new(0)
    live_bills.each do |bill|
      if bill.lot_no_list.empty?
        errors.add(:sauda_bills, "must each say which lot nos they cover")
        next
      end

      bill.lot_no_list.each { |lot_no| seen[lot_no] += 1 }
    end

    return unless seen.any? { |_, count| count > 1 }

    errors.add(:sauda_bills, "cannot cover the same lot no. on more than one bill")
  end
end
