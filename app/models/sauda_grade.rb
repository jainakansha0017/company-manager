# One grade within a mark on a sauda: how many bags, and what one bag weighs.
class SaudaGrade < ApplicationRecord
  belongs_to :sauda_mark

  before_validation :normalise_grade

  validates :grade, presence: true, length: { maximum: 255 }
  validates :bags, numericality: { only_integer: true, greater_than: 0 }
  validates :weight, numericality: { greater_than: 0 }
  validates :rate, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Kilograms this grade contributes: bags x the weight of one bag.
  def total_kg
    return 0 if bags.blank? || weight.blank?

    bags * weight
  end

  # This grade's share of the bill: its kilos at its rate per kilo. Nil rather
  # than zero when no rate has been set, so a sauda priced on none of its grades
  # can be told apart from one genuinely worth nothing.
  def amount
    return if rate.blank?

    (total_kg * rate).round(2)
  end

  private

  def normalise_grade
    self.grade = grade.strip.squeeze(" ") if grade.present?
  end
end
