# One mark on a sauda, with its lot numbers and a row per grade.
class SaudaMark < ApplicationRecord
  LOT_SEPARATOR = "; ".freeze

  belongs_to :sauda
  belongs_to :mark

  has_many :sauda_grades, dependent: :destroy
  accepts_nested_attributes_for :sauda_grades, allow_destroy: true

  before_validation :normalise_lot_nos

  validate :must_have_a_grade
  validate :mark_belongs_to_the_seller

  # Lot numbers are entered as free text separated by semicolons.
  def lot_no_list
    lot_nos.to_s.split(";").map(&:strip).reject(&:blank?)
  end

  def total_kg
    live_grades.sum(&:total_kg)
  end

  private

  def live_grades
    sauda_grades.reject(&:marked_for_destruction?)
  end

  # Re-joined so "A ;;B; " and "A; B" are stored identically.
  def normalise_lot_nos
    self.lot_nos = lot_no_list.join(LOT_SEPARATOR).presence
  end

  def must_have_a_grade
    return if live_grades.any?

    errors.add(:sauda_grades, "must include at least one grade")
  end

  # The marks offered are the seller's own, so anything else is a mistake.
  def mark_belongs_to_the_seller
    return if mark.nil? || sauda.nil? || sauda.seller.nil? || mark.seller == sauda.seller

    errors.add(:mark, "does not belong to this seller")
  end
end
