# One bill on a sauda, covering either every lot (lot_nos blank, the only
# bill there is) or a subset of them, when the sauda has been split into more
# than one bill. Its own tax invoice figures are this bill's share of the
# sauda, priced the same chain the sauda itself used to run, just one link
# per bill rather than one for the whole sauda.
class SaudaBill < ApplicationRecord
  LOT_SEPARATOR = "; ".freeze

  belongs_to :sauda

  before_validation :normalise_lot_nos
  before_validation :recalculate_amounts

  validates :bill_no, length: { maximum: 255 }
  validates :discount_percent,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
            allow_nil: true

  # Lot numbers are entered as free text separated by semicolons, the same
  # convention as a sauda_mark's own lot_nos.
  def lot_no_list
    lot_nos.to_s.split(";").map(&:strip).reject(&:blank?)
  end

  # This bill's amount is priced straight from its own grades — only the ones
  # lined up with the lot nos this bill was given (every grade of every mark,
  # when "All" is checked) — not a kg share of the sauda's total. Lots can be
  # rated differently from one another, so dividing the sauda's total
  # proportionally by kg would misprice a bill whenever its lots' rates
  # differ from the rest. The discount comes off at this bill's own rate
  # rather than the sauda's, since a split sauda can carry more than one.
  #
  # Public, and also called directly by `Sauda`: Rails' own autosave validation
  # skips an association member it does not consider "changed", so a sauda
  # saved after only a mark's rate changed (the bill itself untouched) cannot
  # rely on this running merely because it is a `before_validation` here.
  def recalculate_amounts
    bill_grades = sauda&.grades_for_bill(self) || []
    self.total_kg = bill_grades.sum(&:total_kg)

    priced = bill_grades.filter_map(&:amount)

    if priced.empty?
      self.amount = self.disc_amt = self.taxable_value = self.gst_amt = self.total_tax_bill_amt = nil
      self.brokerage_amt = nil
      return
    end

    self.amount = priced.sum
    self.disc_amt = (amount * discount_percent.to_d / 100).round(2)
    self.taxable_value = (amount - disc_amt).round(2)
    self.gst_amt = (taxable_value * Sauda::GST_RATE).round(2)
    self.total_tax_bill_amt = (taxable_value + gst_amt).round(2)
    self.brokerage_amt = set_brokerage_amt
  end

  private

  # Re-joined so "A ;;B; " and "A; B" are stored identically.
  def normalise_lot_nos
    self.lot_nos = lot_no_list.join(LOT_SEPARATOR).presence
  end

  # The broker takes one per cent, but of which figure is the seller's own
  # arrangement: some are dealt with on the goods, some on what is taxed after
  # the discount. A seller with no arrangement recorded has no brokerage.
  def set_brokerage_amt
    case sauda&.seller&.brokerage_basis
    when "amount" then (amount * Sauda::BROKERAGE_RATE).round(2)
    when "taxable_value" then (taxable_value * Sauda::BROKERAGE_RATE).round(2)
    end
  end
end
