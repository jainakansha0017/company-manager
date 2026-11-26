# One bill on a sauda, covering either every lot (lot_nos blank, the only
# bill there is) or a subset of them, when the sauda has been split into more
# than one bill.
class SaudaBill < ApplicationRecord
  LOT_SEPARATOR = "; ".freeze

  belongs_to :sauda

  before_validation :normalise_lot_nos

  validates :bill_no, :bilty_no, length: { maximum: 255 }

  # Lot numbers are entered as free text separated by semicolons, the same
  # convention as a sauda_mark's own lot_nos.
  def lot_no_list
    lot_nos.to_s.split(";").map(&:strip).reject(&:blank?)
  end

  private

  # Re-joined so "A ;;B; " and "A; B" are stored identically.
  def normalise_lot_nos
    self.lot_nos = lot_no_list.join(LOT_SEPARATOR).presence
  end
end
