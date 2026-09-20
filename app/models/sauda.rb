# One entry in a company's sauda register: what was sold, to whom, under which
# marks. Quantities live on the mark/grade rows; `total_kg` is derived from them.
class Sauda < ApplicationRecord
  belongs_to :company
  belongs_to :seller
  belongs_to :buyer

  has_many :sauda_marks, dependent: :destroy
  accepts_nested_attributes_for :sauda_marks, allow_destroy: true

  before_validation :set_total_kg

  validates :sauda_date, presence: true
  validates :tax_invoice_no, :destination, length: { maximum: 255 }
  validates :total_tax_bill_amt, :gst_amt, :disc_amt, :taxable_value,
            numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validate :seller_belongs_to_company
  validate :buyer_belongs_to_company
  validate :must_have_a_mark

  scope :ordered, -> { order(sauda_date: :desc, id: :desc) }

  private

  def live_marks
    sauda_marks.reject(&:marked_for_destruction?)
  end

  def set_total_kg
    self.total_kg = live_marks.sum(&:total_kg)
  end

  def must_have_a_mark
    return if live_marks.any?

    errors.add(:sauda_marks, "must include at least one mark")
  end

  # A company can only trade with its own parties. Compared as records rather
  # than ids so this still holds for an unsaved sauda, where both ids are nil.
  def seller_belongs_to_company
    return if seller.nil? || company.nil? || seller.company == company

    errors.add(:seller, "does not belong to this company")
  end

  def buyer_belongs_to_company
    return if buyer.nil? || company.nil? || buyer.company == company

    errors.add(:buyer, "does not belong to this company")
  end
end
