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

  def total_bags
    live_grades.sum { |grade| grade.bags.to_i }
  end

  def total_kg
    live_grades.sum(&:total_kg)
  end

  # What this mark comes to, counting only the grades that carry a rate. Nil
  # when none of them do, so an unpriced mark adds nothing to the sauda.
  def amount
    priced = live_grades.filter_map(&:amount)

    priced.sum if priced.any?
  end

  # The grade entered in the same position as a given lot no. — the first
  # grade typed prices the first lot, the second grade the second lot, and so
  # on. Nil if the lot isn't one of this mark's own, or it has no grade lined
  # up with it.
  def grade_for_lot(lot_no)
    index = lot_no_list.index(lot_no)
    index && live_grades[index]
  end

  def live_grades
    sauda_grades.reject(&:marked_for_destruction?)
  end

  private

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
